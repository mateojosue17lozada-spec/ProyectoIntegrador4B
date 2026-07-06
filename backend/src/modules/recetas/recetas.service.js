const pool = require("../../config/database");
const audit = require("../../utils/audit");

exports.listar = async () => (await pool.query(
    `SELECT r.*,p.nombre paciente_nombre,p.apellido paciente_apellido
     FROM recetas r JOIN pacientes p USING(id_paciente) ORDER BY r.creado_en DESC`
)).rows;

exports.obtener = async (id) => {
    const result = await pool.query(
        `SELECT r.*,p.nombre paciente_nombre,p.apellido paciente_apellido,p.cedula,p.telefono,
                u.nombre optometra_nombre,u.apellido optometra_apellido,h.id_cita
         FROM recetas r JOIN pacientes p USING(id_paciente)
         LEFT JOIN usuarios u ON u.id_usuario=r.id_optometra
         LEFT JOIN historias_clinicas h USING(id_historia) WHERE id_receta=$1`, [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Receta no encontrada"), { status: 404 });
    return result.rows[0];
};

exports.crear = async (data, usuario, req) => {
    if (!data.id_historia || !data.id_paciente) throw Object.assign(new Error("Historia y paciente son obligatorios"), { status: 400 });
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const historia = await client.query(
            "SELECT id_paciente,id_cita FROM historias_clinicas WHERE id_historia=$1", [data.id_historia]
        );
        if (!historia.rows[0] || Number(historia.rows[0].id_paciente) !== Number(data.id_paciente)) {
            throw Object.assign(new Error("La historia no corresponde al paciente"), { status: 409 });
        }
        const detalles = {
            dnp: data.dnp || null, av_vl: data.av_vl || null, av_vp: data.av_vp || null,
            tipo_lente: data.tipo_lente || null, material: data.material || null,
            filtro: data.filtro || null, prisma: data.prisma || null
        };
        const result = await client.query(
            `INSERT INTO recetas(id_historia,id_paciente,id_optometra,od_esfera,od_cilindro,od_eje,
             oi_esfera,oi_cilindro,oi_eje,adicion,observaciones,detalles)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [data.id_historia,data.id_paciente,usuario.id,data.od_esfera || null,data.od_cilindro || null,
             data.od_eje || null,data.oi_esfera || null,data.oi_cilindro || null,data.oi_eje || null,
             data.adicion || null,data.observaciones || null,detalles]
        );
        await client.query("UPDATE citas SET estado='Atendida',actualizado_en=NOW() WHERE id_cita=$1", [historia.rows[0].id_cita]);
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "RECETA_CREADA", tabla: "recetas", registroId: result.rows[0].id_receta, req });
        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};

exports.marcarImpresa = async (id, usuario, req) => {
    const result = await pool.query("UPDATE recetas SET impresa=TRUE WHERE id_receta=$1 RETURNING *", [id]);
    if (!result.rows[0]) throw Object.assign(new Error("Receta no encontrada"), { status: 404 });
    await audit({ idUsuario: usuario.id, accion: "RECETA_IMPRESA", tabla: "recetas", registroId: Number(id), req });
    return exports.obtener(id);
};

exports.listarPedidos = async () => (await pool.query(
    `SELECT pl.*,l.nombre laboratorio_nombre,p.nombre paciente_nombre,p.apellido paciente_apellido
     FROM pedidos_laboratorio pl LEFT JOIN laboratorios l USING(id_laboratorio)
     LEFT JOIN recetas r USING(id_receta) LEFT JOIN pacientes p USING(id_paciente)
     ORDER BY pl.fecha_envio DESC`
)).rows;

exports.crearPedido = async (data, usuario, req) => {
    if (!data.id_receta) throw Object.assign(new Error("La receta es obligatoria"), { status: 400 });
    const result = await pool.query(
        `INSERT INTO pedidos_laboratorio(id_receta,id_laboratorio,descripcion)
         VALUES($1,$2,$3) RETURNING *`, [data.id_receta,data.id_laboratorio || null,data.descripcion || null]
    );
    await audit({ idUsuario: usuario.id, accion: "PEDIDO_LABORATORIO_CREADO", tabla: "pedidos_laboratorio", registroId: result.rows[0].id_pedido_laboratorio, req });
    return result.rows[0];
};

exports.actualizarPedido = async (id, data, usuario, req) => {
    const result = await pool.query(
        `UPDATE pedidos_laboratorio SET estado=COALESCE($1,estado),estado_ensamblaje=COALESCE($2,estado_ensamblaje),
         fecha_entrega=COALESCE($3,fecha_entrega),impreso=COALESCE($4,impreso),actualizado_en=NOW()
         WHERE id_pedido_laboratorio=$5 RETURNING *`,
        [data.estado || null,data.estado_ensamblaje || null,data.fecha_entrega || null,data.impreso,id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });
    await audit({ idUsuario: usuario.id, accion: "PEDIDO_LABORATORIO_ACTUALIZADO", tabla: "pedidos_laboratorio", registroId: Number(id), detalle: data, req });
    return result.rows[0];
};

exports.laboratorios = async () => (await pool.query("SELECT * FROM laboratorios ORDER BY nombre")).rows;
exports.crearLaboratorio = async (data) => (await pool.query("INSERT INTO laboratorios(nombre,telefono,correo,direccion) VALUES($1,$2,$3,$4) RETURNING *", [data.nombre,data.telefono || null,data.correo || null,data.direccion || null])).rows[0];
exports.actualizarLaboratorio = async (id,data) => { const r=await pool.query("UPDATE laboratorios SET nombre=$1,telefono=$2,correo=$3,direccion=$4 WHERE id_laboratorio=$5 RETURNING *",[data.nombre,data.telefono || null,data.correo || null,data.direccion || null,id]);if(!r.rows[0])throw Object.assign(new Error("Laboratorio no encontrado"),{status:404});return r.rows[0]; };
exports.eliminarLaboratorio = async (id) => { const r=await pool.query("DELETE FROM laboratorios WHERE id_laboratorio=$1 RETURNING *",[id]);if(!r.rows[0])throw Object.assign(new Error("Laboratorio no encontrado"),{status:404});return r.rows[0]; };
