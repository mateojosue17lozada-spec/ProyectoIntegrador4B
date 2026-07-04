const pool=require("../../config/database");const audit=require("../../utils/audit");
exports.listar=async()=>(await pool.query(`SELECT u.id_usuario,u.nombre,u.apellido,u.correo,u.usuario,u.cedula,u.telefono,
 u.estado,u.bloqueado,u.intentos_fallidos,u.ultimo_login,r.nombre_rol FROM usuarios u LEFT JOIN roles r USING(id_rol) ORDER BY u.nombre`)).rows;
exports.roles=async()=>(await pool.query("SELECT * FROM roles ORDER BY nombre_rol")).rows;
exports.cambiarEstado=async(id,data,u,req)=>{const r=await pool.query(`UPDATE usuarios SET estado=COALESCE($1,estado),bloqueado=COALESCE($2,bloqueado),
 intentos_fallidos=CASE WHEN $2=FALSE THEN 0 ELSE intentos_fallidos END,id_rol=COALESCE($3,id_rol) WHERE id_usuario=$4 RETURNING id_usuario,nombre,estado,bloqueado,id_rol`,[data.estado,data.bloqueado,data.id_rol||null,id]);if(!r.rows[0])throw new Error("Usuario no encontrado");await audit({idUsuario:u.id,accion:"USUARIO_ACTUALIZADO",tabla:"usuarios",registroId:Number(id),detalle:data,req});return r.rows[0]};
exports.auditoria=async(limite=100)=>(await pool.query(`SELECT a.*,u.usuario FROM auditoria a LEFT JOIN usuarios u USING(id_usuario) ORDER BY a.fecha DESC LIMIT $1`,[Math.min(Number(limite)||100,500)])).rows;
