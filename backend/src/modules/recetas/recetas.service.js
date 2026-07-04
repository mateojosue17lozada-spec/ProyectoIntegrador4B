const pool = require("../../config/database");
const registrarAuditoria = require("../../utils/audit");

exports.listar = async () => (await pool.query(
    `SELECT r.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
     FROM recetas r JOIN pacientes p USING(id_paciente) ORDER BY r.creado_en DESC`
)).rows;

exports.obtener = async (id) => {
    const result = await pool.query(
        `SELECT r.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
                p.cedula, u.nombre AS optometra_nombre
         FROM recetas r JOIN pacientes p USING(id_paciente)
         LEFT JOIN usuarios u ON u.id_usuario=r.id_optometra WHERE id_receta=$1`, [id]
    );
    if (!result.rows[0]) throw new Error("Receta no encontrada");
    return result.rows[0];
};

exports.crear = async (data, usuario, req) => {
    const result = await pool.query(
        `INSERT INTO recetas (id_historia,id_paciente,id_optometra,od_esfera,od_cilindro,
         od_eje,oi_esfera,oi_cilindro,oi_eje,adicion,observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [data.id_historia || null,data.id_paciente,usuario.id,data.od_esfera||null,data.od_cilindro||null,
         data.od_eje||null,data.oi_esfera||null,data.oi_cilindro||null,data.oi_eje||null,data.adicion||null,data.observaciones||null]
    );
    await registrarAuditoria({idUsuario:usuario.id,accion:"RECETA_CREADA",tabla:"recetas",registroId:result.rows[0].id_receta,req});
    return result.rows[0];
};

exports.marcarImpresa = async (id, usuario, req) => {
    const result=await pool.query("UPDATE recetas SET impresa=TRUE WHERE id_receta=$1 RETURNING *",[id]);
    if(!result.rows[0]) throw new Error("Receta no encontrada");
    await registrarAuditoria({idUsuario:usuario.id,accion:"RECETA_IMPRESA",tabla:"recetas",registroId:Number(id),req});
    return result.rows[0];
};

exports.listarPedidos = async () => (await pool.query(
    `SELECT pl.*, l.nombre AS laboratorio_nombre FROM pedidos_laboratorio pl
     LEFT JOIN laboratorios l USING(id_laboratorio) ORDER BY pl.fecha_envio DESC`
)).rows;

exports.crearPedido = async (data) => (await pool.query(
    `INSERT INTO pedidos_laboratorio(id_receta,id_laboratorio,descripcion)
     VALUES($1,$2,$3) RETURNING *`,[data.id_receta,data.id_laboratorio||null,data.descripcion||null]
)).rows[0];

exports.actualizarPedido = async (id,data) => (await pool.query(
    `UPDATE pedidos_laboratorio SET estado=COALESCE($1,estado),
     estado_ensamblaje=COALESCE($2,estado_ensamblaje), fecha_entrega=$3,
     impreso=COALESCE($4,impreso) WHERE id_pedido_laboratorio=$5 RETURNING *`,
    [data.estado||null,data.estado_ensamblaje||null,data.fecha_entrega||null,data.impreso,id]
)).rows[0];
exports.laboratorios=async()=>(await pool.query("SELECT * FROM laboratorios ORDER BY nombre")).rows;
exports.crearLaboratorio=async(data)=>(await pool.query("INSERT INTO laboratorios(nombre,telefono,correo,direccion) VALUES($1,$2,$3,$4) RETURNING *",[data.nombre,data.telefono||null,data.correo||null,data.direccion||null])).rows[0];
exports.actualizarLaboratorio=async(id,data)=>{const r=await pool.query("UPDATE laboratorios SET nombre=$1,telefono=$2,correo=$3,direccion=$4 WHERE id_laboratorio=$5 RETURNING *",[data.nombre,data.telefono||null,data.correo||null,data.direccion||null,id]);if(!r.rows[0])throw Object.assign(new Error("Laboratorio no encontrado"),{status:404});return r.rows[0]};
exports.eliminarLaboratorio=async(id)=>{const r=await pool.query("DELETE FROM laboratorios WHERE id_laboratorio=$1 RETURNING *",[id]);if(!r.rows[0])throw Object.assign(new Error("Laboratorio no encontrado"),{status:404});return r.rows[0]};
