const pool = require("../../config/database");
const audit = require("../../utils/audit");

exports.listar = async () => (await pool.query(
    `SELECT u.id_usuario,u.nombre,u.apellido,u.correo,u.usuario,u.cedula,u.telefono,
            u.id_rol,u.estado,u.bloqueado,u.ultimo_login,r.nombre_rol
     FROM usuarios u JOIN roles r USING(id_rol) ORDER BY u.nombre,u.apellido`
)).rows;

exports.roles = async () => (await pool.query("SELECT * FROM roles ORDER BY id_rol")).rows;

exports.auditoria = async (limite = 100) => (await pool.query(
    `SELECT a.*,COALESCE(u.usuario,'Sistema') usuario
     FROM auditoria a LEFT JOIN usuarios u USING(id_usuario)
     ORDER BY a.fecha DESC LIMIT $1`,
    [Math.min(Math.max(Number(limite) || 100, 1), 500)]
)).rows;

exports.cambiarEstado = async (id, data, usuario, req) => {
    if (Number(id) === Number(usuario.id) && data.estado === false) {
        throw Object.assign(new Error("No puede desactivar su propia cuenta"), { status: 400 });
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(
            `UPDATE usuarios SET estado=COALESCE($1,estado),bloqueado=COALESCE($2,bloqueado),
             intentos_fallidos=CASE WHEN $2=FALSE THEN 0 ELSE intentos_fallidos END
             WHERE id_usuario=$3 RETURNING id_usuario,nombre,apellido,correo,usuario,estado,bloqueado,id_rol`,
            [typeof data.estado === "boolean" ? data.estado : null,
             typeof data.bloqueado === "boolean" ? data.bloqueado : null, id]
        );
        if (!result.rows[0]) throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
        if (data.estado === false || data.bloqueado === true) {
            await client.query("UPDATE sesiones_usuario SET revocada_en=NOW() WHERE id_usuario=$1 AND revocada_en IS NULL", [id]);
        }
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "USUARIO_ACCESO_ACTUALIZADO", tabla: "usuarios", registroId: Number(id), detalle: data, req });
        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};
