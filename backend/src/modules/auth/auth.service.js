const crypto = require("crypto");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../../config/database");
const registrarAuditoria = require("../../utils/audit");
const enviarRecuperacion = require("../../utils/email");

const MAX_INTENTOS = 3;
const MINUTOS_RESET = 30;

const normalizarIdentificador = (valor) => String(valor || "").trim().toLowerCase();

const generarTokenPlano = () => crypto.randomBytes(32).toString("hex");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

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
            bloqueado = FALSE
        WHERE id_usuario = $1
        `,
        [idUsuario]
    );
};

const registrarIntentoFallido = async (usuario) => {
    const intentos = Number(usuario.intentos_fallidos || 0) + 1;
    const bloquear = intentos >= MAX_INTENTOS;

    await pool.query(
        `
        UPDATE usuarios
        SET intentos_fallidos = $1,
            bloqueado = $2
        WHERE id_usuario = $3
        `,
        [intentos, bloquear, usuario.id_usuario]
    );

    if (bloquear) {
        throw new Error("Usuario bloqueado por tres intentos fallidos");
    }

    throw new Error(`Credenciales incorrectas. Intento ${intentos} de ${MAX_INTENTOS}`);
};

exports.login = async ({ identificador, correo, usuario, password, req }) => {
    const valorLogin = identificador || correo || usuario;
    const usuarioEncontrado = await obtenerUsuarioPorIdentificador(valorLogin);

    if (!usuarioEncontrado) {
        throw new Error("Usuario no encontrado");
    }

    if (usuarioEncontrado.activo === false || usuarioEncontrado.estado === false || usuarioEncontrado.estado === "Inactivo") {
        throw new Error("Usuario inactivo");
    }

    if (usuarioEncontrado.bloqueado === true || usuarioEncontrado.estado === "Bloqueado") {
        throw new Error("Usuario bloqueado por intentos fallidos");
    }

    const passwordCorrecto = await bcrypt.compare(password || "", usuarioEncontrado.password);

    if (!passwordCorrecto) {
        await registrarAuditoria({
            idUsuario: usuarioEncontrado.id_usuario,
            accion: "LOGIN_FALLIDO",
            tabla: "usuarios",
            registroId: usuarioEncontrado.id_usuario,
            req
        });

        await registrarIntentoFallido(usuarioEncontrado);
    }

    await limpiarIntentosFallidos(usuarioEncontrado.id_usuario);

    await pool.query(
        "UPDATE usuarios SET ultimo_login = NOW() WHERE id_usuario = $1",
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
        accion: "LOGIN_EXITOSO",
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

    if (!password || password.length < 8) {
        throw new Error("La contrasena debe tener al menos 8 caracteres");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
        `
        INSERT INTO usuarios
        (nombre, apellido, correo, usuario, password, cedula, telefono, id_rol)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id_usuario, nombre, apellido, correo, usuario, cedula, telefono, id_rol
        `,
        [
            nombre,
            apellido,
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

    if (!usuarioEncontrado) {
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
    if (!password || password.length < 8) {
        throw new Error("La contrasena debe tener al menos 8 caracteres");
    }

    const tokenHash = hashToken(token || "");

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    let idUsuario;

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
            SELECT id_recuperacion, id_usuario
            FROM recuperacion_password
            WHERE token = $1
              AND expiracion > NOW()
              AND usado = FALSE
            ORDER BY id_recuperacion DESC
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
                bloqueado = FALSE
            WHERE id_usuario = $2
            `,
            [passwordHash, idUsuario]
        );

        await client.query(
            "UPDATE recuperacion_password SET usado = TRUE WHERE id_recuperacion = $1",
            [result.rows[0].id_recuperacion]
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
