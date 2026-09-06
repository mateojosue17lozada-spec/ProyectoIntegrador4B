require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("../config/database");

const [, , accion, identificador, password] = process.argv;

const listar = async () => {
    const result = await pool.query(
        `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.usuario, u.estado,
                u.bloqueado, u.intentos_fallidos, u.ultimo_login, r.nombre_rol
         FROM usuarios u
         LEFT JOIN roles r ON r.id_rol = u.id_rol
         ORDER BY u.id_usuario`
    );
    console.table(result.rows);
    console.log(`Total de usuarios: ${result.rowCount}`);
};

const resetear = async () => {
    if (!identificador || !password) {
        throw new Error("Uso: node ./src/scripts/resetPassword.js reset <correo|usuario> <nuevaPassword>");
    }
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        throw new Error("La contraseña debe tener 10+ caracteres e incluir mayúscula, minúscula y número");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
        `UPDATE usuarios
         SET password = $1,
             intentos_fallidos = 0,
             bloqueado = FALSE,
             bloqueado_hasta = NULL,
             estado = TRUE
         WHERE lower(correo) = $2 OR lower(usuario) = $2
         RETURNING id_usuario, nombre, correo, usuario`,
        [passwordHash, String(identificador).trim().toLowerCase()]
    );

    if (!result.rowCount) throw new Error(`No existe un usuario con correo o usuario "${identificador}"`);
    console.log("Contraseña actualizada para:", result.rows[0]);
};

const run = async () => {
    try {
        if (accion === "reset") await resetear();
        else await listar();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
};

run();
