const crypto = require("crypto");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../../config/database");
const registrarAuditoria = require("../../utils/audit");
const enviarRecuperacion = require("../../utils/email");

const MAX_INTENTOS = 3;
const MINUTOS_RESET = 30;
const LOGIN_MESSAGE = "Usuario o contraseña incorrectos.";
const loginLockMinutes = () => {
    const value = Number(process.env.LOGIN_LOCK_MINUTES || 15);
    return Number.isFinite(value) && value > 0 ? Math.min(value, 1440) : 15;
};
const authError = (internalCode) => Object.assign(new Error(LOGIN_MESSAGE), { status: 401, internalCode });

const normalizarIdentificador = (valor) => String(valor || "").trim().toLowerCase();

const generarTokenPlano = () => crypto.randomBytes(32).toString("hex");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const validarPassword = (password) => {
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
        throw Object.assign(new Error("La contraseña debe tener entre 10 y 128 caracteres"), { status: 400 });
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        throw Object.assign(new Error("La contraseña debe incluir mayúscula, minúscula y número"), { status: 400 });
    }
};

const obtenerUsuarioPorIdentificador = async (identificador) => {
    const valor = normalizarIdentificador(identificador);

    const result = await pool.query(
        `
        SELECT
            u.*,
            r.nombre_rol
        FROM usuarios u
        INNER JOIN roles r ON u.id_rol = r.id_rol
        WHERE lower(u.correo) = $1 OR lower(u.usuario) = $1
        LIMIT 1
        `,
        [valor]
    );

    return result.rows[0];
};

const limpiarIntentosFallidos = async (idUsuario) => {
    await pool.query(
        `
        UPDATE usuarios
        SET intentos_fallidos = 0,
            bloqueado = FALSE,
            bloqueado_hasta = NULL
        WHERE id_usuario = $1
        `,
        [idUsuario]
    );
};

const registrarIntentoFallido = async (usuario) => {
    const result = await pool.query(
        `
        UPDATE usuarios
        SET intentos_fallidos = LEAST(intentos_fallidos + 1, $1),
            ultimo_intento_fallido_en = NOW(),
            bloqueado = (intentos_fallidos + 1 >= $1),
            bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $1
                THEN NOW() + ($2::text || ' minutes')::interval ELSE NULL END
        WHERE id_usuario = $3
          AND (bloqueado_hasta IS NULL OR bloqueado_hasta <= NOW())
        RETURNING intentos_fallidos, bloqueado
        `,
        [MAX_INTENTOS, loginLockMinutes(), usuario.id_usuario]
    );

    throw authError(result.rows[0]?.bloqueado ? "LOGIN_BLOCKED" : "LOGIN_FAILED");
};

exports.login = async ({ identificador, correo, usuario, password, req }) => {
    const valorLogin = identificador || correo || usuario;
    const usuarioEncontrado = await obtenerUsuarioPorIdentificador(valorLogin);

    if (!usuarioEncontrado) {
        await bcrypt.compare(password || "", "$2b$10$8WzVQZrGMYn0HjHLV7R9B.TvvGSJNXU8NwMJuVsDXXHGr3kKfIHIq");
        throw authError("LOGIN_FAILED_UNKNOWN");
    }

    if (usuarioEncontrado.activo === false || usuarioEncontrado.estado === false || usuarioEncontrado.estado === "Inactivo") {
        throw authError("LOGIN_INACTIVE_USER");
    }

    if (usuarioEncontrado.bloqueado_hasta && new Date(usuarioEncontrado.bloqueado_hasta).getTime() > Date.now()) {
        await registrarAuditoria({ idUsuario: usuarioEncontrado.id_usuario, accion: "LOGIN_BLOCKED", tabla: "usuarios", registroId: usuarioEncontrado.id_usuario, detalle: { resultado: "fallido", motivo: "LOGIN_BLOCKED" }, req });
        throw authError("LOGIN_BLOCKED");
    }
    if (usuarioEncontrado.bloqueado === true || usuarioEncontrado.bloqueado_hasta) {
        await limpiarIntentosFallidos(usuarioEncontrado.id_usuario);
        usuarioEncontrado.intentos_fallidos = 0;
    }

    const passwordCorrecto = await bcrypt.compare(password || "", usuarioEncontrado.password);

    if (!passwordCorrecto) {
        await registrarAuditoria({
            idUsuario: usuarioEncontrado.id_usuario,
            accion: "LOGIN_FAILED",
            tabla: "usuarios",
            registroId: usuarioEncontrado.id_usuario,
            req
        });

        await registrarIntentoFallido(usuarioEncontrado);
    }

    await limpiarIntentosFallidos(usuarioEncontrado.id_usuario);

    await pool.query(
        "UPDATE usuarios SET ultimo_login=NOW(),intentos_fallidos=0,bloqueado=FALSE,bloqueado_hasta=NULL WHERE id_usuario=$1",
        [usuarioEncontrado.id_usuario]
    );

    const token = jwt.sign(
        {
            id: usuarioEncontrado.id_usuario,
            nombre: usuarioEncontrado.nombre,
            correo: usuarioEncontrado.correo,
            rol: usuarioEncontrado.nombre_rol,
            jti: crypto.randomUUID()
        },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
    );

    const sesion = jwt.decode(token);
    await pool.query(
        `INSERT INTO sesiones_usuario (id_sesion, id_usuario, expira_en)
         VALUES ($1,$2,TO_TIMESTAMP($3))`,
        [sesion.jti, usuarioEncontrado.id_usuario, sesion.exp]
    );

    await registrarAuditoria({
        idUsuario: usuarioEncontrado.id_usuario,
        accion: "LOGIN_SUCCESS",
        tabla: "usuarios",
        registroId: usuarioEncontrado.id_usuario,
        req
    });

    return {
        mensaje: "Login correcto",
        token,
        usuario: {
            id: usuarioEncontrado.id_usuario,
            nombre: usuarioEncontrado.nombre,
            apellido: usuarioEncontrado.apellido,
            correo: usuarioEncontrado.correo,
            usuario: usuarioEncontrado.usuario,
            rol: usuarioEncontrado.nombre_rol
        }
    };
};

exports.logout = async ({ jti, idUsuario, req }) => {
    if (jti) {
        await pool.query(
            "UPDATE sesiones_usuario SET revocada_en = NOW() WHERE id_sesion = $1 AND id_usuario = $2",
            [jti, idUsuario]
        );
    }

    await registrarAuditoria({
        idUsuario,
        accion: "LOGOUT",
        tabla: "sesiones_usuario",
        req
    });

    return { mensaje: "Sesion cerrada correctamente" };
};

exports.register = async (data, req) => {
    const {
        nombre,
        apellido,
        correo,
        usuario,
        password,
        cedula,
        telefono,
        id_rol
    } = data;

    validarPassword(password);

    if (!String(nombre || "").trim() || !String(correo || "").trim() || !String(usuario || "").trim() || !id_rol) {
        throw Object.assign(new Error("Nombre, correo, usuario y rol son obligatorios"), { status: 400 });
    }

    const rolExiste = await pool.query("SELECT 1 FROM roles WHERE id_rol=$1", [id_rol]);
    if (!rolExiste.rowCount) throw Object.assign(new Error("Rol inválido"), { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
        `
        INSERT INTO usuarios
        (nombre, apellido, correo, usuario, password, cedula, telefono, id_rol)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id_usuario, nombre, apellido, correo, usuario, cedula, telefono, id_rol
        `,
        [
            String(nombre).trim(),
            String(apellido || "").trim() || null,
            normalizarIdentificador(correo),
            normalizarIdentificador(usuario),
            passwordHash,
            cedula,
            telefono,
            id_rol
        ]
    );

    await registrarAuditoria({
        idUsuario: req?.usuario?.id || result.rows[0].id_usuario,
        accion: "USUARIO_CREADO",
        tabla: "usuarios",
        registroId: result.rows[0].id_usuario,
        detalle: { correo: result.rows[0].correo, rol: id_rol },
        req
    });

    return result.rows[0];
};

exports.solicitarRecuperacion = async ({ identificador, correo, req }) => {
    const usuarioEncontrado = await obtenerUsuarioPorIdentificador(identificador || correo);

    if (!usuarioEncontrado || usuarioEncontrado.estado === false || usuarioEncontrado.activo === false) {
        return {
            mensaje: "Si el usuario existe, se enviaran instrucciones de recuperacion"
        };
    }

    const tokenPlano = generarTokenPlano();
    const tokenHash = hashToken(tokenPlano);

    await pool.query(
        `
        UPDATE recuperacion_password
        SET usado = TRUE
        WHERE id_usuario = $1
          AND usado = FALSE
        `,
        [usuarioEncontrado.id_usuario]
    );

    await pool.query(
        `
        INSERT INTO recuperacion_password
        (id_usuario, token, expiracion, usado)
        VALUES ($1,$2,NOW() + ($3 || ' minutes')::interval,FALSE)
        `,
        [usuarioEncontrado.id_usuario, tokenHash, MINUTOS_RESET]
    );

    await registrarAuditoria({
        idUsuario: usuarioEncontrado.id_usuario,
        accion: "PASSWORD_RESET_SOLICITADO",
        tabla: "usuarios",
        registroId: usuarioEncontrado.id_usuario,
        req
    });

    const correoEnviado = await enviarRecuperacion({
        correo: usuarioEncontrado.correo,
        nombre: usuarioEncontrado.nombre,
        token: tokenPlano
    });

    return {
        mensaje: "Si el usuario existe, se enviaran instrucciones de recuperacion",
        resetToken: process.env.NODE_ENV === "production" || correoEnviado ? undefined : tokenPlano
    };
};

exports.restablecerPassword = async ({ token, password, req }) => {
    validarPassword(password);

    const tokenHash = hashToken(token || "");

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    let idUsuario;

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
            SELECT rp.id_recuperacion, rp.id_usuario
            FROM recuperacion_password rp
            JOIN usuarios u ON u.id_usuario=rp.id_usuario
            WHERE rp.token = $1
              AND rp.expiracion > NOW()
              AND rp.usado = FALSE
              AND u.estado = TRUE
            ORDER BY rp.id_recuperacion DESC
            LIMIT 1
            FOR UPDATE
            `,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            throw new Error("Token invalido o expirado");
        }

        idUsuario = result.rows[0].id_usuario;

        await client.query(
            `
            UPDATE usuarios
            SET password = $1,
                intentos_fallidos = 0,
                bloqueado = FALSE,
                bloqueado_hasta = NULL
            WHERE id_usuario = $2
            `,
            [passwordHash, idUsuario]
        );

        await client.query(
            "UPDATE recuperacion_password SET usado = TRUE WHERE id_recuperacion = $1",
            [result.rows[0].id_recuperacion]
        );

        await client.query(
            "UPDATE sesiones_usuario SET revocada_en = NOW() WHERE id_usuario = $1 AND revocada_en IS NULL",
            [idUsuario]
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    await registrarAuditoria({
        idUsuario,
        accion: "PASSWORD_RESTABLECIDO",
        tabla: "usuarios",
        registroId: idUsuario,
        req
    });

    return { mensaje: "Contrasena actualizada correctamente" };
};

exports.validarTokenRecuperacion = async (token) => {
    const tokenHash = hashToken(token || "");
    const result = await pool.query(
        `SELECT 1 FROM recuperacion_password rp JOIN usuarios u ON u.id_usuario=rp.id_usuario
         WHERE rp.token=$1 AND rp.expiracion>NOW() AND rp.usado=FALSE AND u.estado=TRUE LIMIT 1`, [tokenHash]
    );
    if (!result.rowCount) throw Object.assign(new Error("Token inválido o expirado"), { status: 400 });
    return { valido: true };
};

exports.perfil = async (id) => {
    const result = await pool.query(
        `SELECT u.id_usuario,u.nombre,u.apellido,u.correo,u.usuario,u.cedula,u.telefono,
                u.fecha_nacimiento,u.ultimo_login,u.estado,r.nombre_rol rol,
                (SELECT COUNT(*)::int FROM sesiones_usuario s
                 WHERE s.id_usuario=u.id_usuario AND s.revocada_en IS NULL AND s.expira_en>NOW()) sesiones_activas
         FROM usuarios u JOIN roles r USING(id_rol) WHERE u.id_usuario=$1`, [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
    const actividad = await pool.query(
        `SELECT accion,tabla_afectada,fecha FROM auditoria
         WHERE id_usuario=$1 ORDER BY fecha DESC LIMIT 5`, [id]
    );
    return { ...result.rows[0], actividad_reciente: actividad.rows };
};

exports.actualizarPerfil = async (id, data, req) => {
    if (!String(data.nombre || "").trim()) throw Object.assign(new Error("El nombre es obligatorio"), { status: 400 });
    const result = await pool.query(
        `UPDATE usuarios SET nombre=$1,apellido=$2,telefono=$3,fecha_nacimiento=$4
         WHERE id_usuario=$5 RETURNING id_usuario,nombre,apellido,correo,usuario,cedula,telefono,fecha_nacimiento`,
        [String(data.nombre).trim(),String(data.apellido || "").trim() || null,data.telefono || null,data.fecha_nacimiento || null,id]
    );
    await registrarAuditoria({ idUsuario:id, accion:"PERFIL_ACTUALIZADO", tabla:"usuarios", registroId:id, req });
    return result.rows[0];
};
