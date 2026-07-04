const pool = require("../config/database");

const registrarAuditoria = async ({ idUsuario, accion, tabla, registroId, detalle, req }) => {
    try {
        await pool.query(
            `
            INSERT INTO auditoria
            (id_usuario, accion, tabla_afectada, id_registro, detalle, ip, user_agent, fecha)
            VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
            `,
            [
                idUsuario || null,
                accion,
                tabla || null,
                registroId || null,
                detalle ? JSON.stringify(detalle) : null,
                req?.ip || null,
                req?.headers?.["user-agent"] || null
            ]
        );
    } catch (error) {
        console.error("Error registrando auditoria:", error.message);
    }
};

module.exports = registrarAuditoria;
