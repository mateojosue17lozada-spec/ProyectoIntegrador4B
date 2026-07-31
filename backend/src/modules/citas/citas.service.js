const pool = require("../../config/database");
const audit = require("../../utils/audit");

const estados = ["Pendiente", "Confirmada", "Pagada", "En atención", "Atendida", "Cancelada", "No asistio"];

exports.obtener = async (filters = {}) => {
    const values = [], where = [];
    if (filters.desde) { values.push(filters.desde); where.push(`c.fecha_cita >= $${values.length}::date`); }
    if (filters.hasta) { values.push(filters.hasta); where.push(`c.fecha_cita <= $${values.length}::date`); }
    if (filters.estado && filters.estado !== "Todos") { values.push(filters.estado); where.push(`c.estado = $${values.length}`); }
    if (filters.paciente) { values.push(`%${String(filters.paciente).trim()}%`); where.push(`concat_ws(' ',p.nombre,p.apellido) ILIKE $${values.length}`); }
    return (await pool.query(
    `SELECT c.*,p.nombre AS paciente_nombre,p.apellido AS paciente_apellido,
            concat_ws(' ',u.nombre,u.apellido) AS profesional_nombre,
            COALESCE(SUM(pp.monto),0) total_pagado
     FROM citas c JOIN pacientes p USING(id_paciente)
     JOIN usuarios u ON u.id_usuario=c.id_usuario
     LEFT JOIN pagos_previos pp USING(id_cita)
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY c.id_cita,p.nombre,p.apellido,u.nombre,u.apellido
     ORDER BY c.fecha_cita,c.hora_cita`, values
)).rows;
};

exports.crear = async (data) => {
    if (!data.id_paciente || !data.id_usuario || !data.fecha_cita || !data.hora_cita) {
        throw Object.assign(new Error("Paciente, fecha y hora son obligatorios"), { status: 400 });
    }
    const fecha = new Date(`${data.fecha_cita}T${data.hora_cita}`);
    if (Number.isNaN(fecha.getTime())) throw Object.assign(new Error("Fecha u hora inválida"), { status: 400 });

    const conflicto = await pool.query(
        `SELECT 1 FROM citas WHERE fecha_cita=$1 AND hora_cita=$2
         AND estado NOT IN ('Cancelada','No asistio') LIMIT 1`,
        [data.fecha_cita, data.hora_cita]
    );
    if (conflicto.rowCount) throw Object.assign(new Error("Ya existe una cita en ese horario"), { status: 409 });

    return (await pool.query(
        `INSERT INTO citas(id_paciente,id_usuario,fecha_cita,hora_cita,motivo,consultorio,tarifa)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [data.id_paciente,data.id_usuario,data.fecha_cita,data.hora_cita,
         String(data.motivo || "").trim() || null,String(data.consultorio || "").trim() || null,
         Number(data.tarifa || 0)]
    )).rows[0];
};

exports.actualizarEstado = async (id, data, usuario, req) => {
    if (!estados.includes(data.estado)) throw Object.assign(new Error("Estado de cita inválido"), { status: 400 });
    if (["Pagada", "En atención", "Atendida"].includes(data.estado)) {
        const pago = await pool.query("SELECT COALESCE(SUM(monto),0) total FROM pagos_previos WHERE id_cita=$1", [id]);
        if (Number(pago.rows[0].total) <= 0) {
            throw Object.assign(new Error("No puede avanzar la cita sin pago previo"), { status: 402 });
        }
    }
    if (data.estado === "En atención" && !["Administrador", "Optometra"].includes(usuario.rol)) {
        throw Object.assign(new Error("Solo el optómetra puede iniciar la atención"), { status: 403 });
    }
    const result = await pool.query(
        `UPDATE citas SET estado=$1,observacion=COALESCE($2,observacion),actualizado_en=NOW()
         WHERE id_cita=$3 RETURNING *`, [data.estado,data.observacion || null,id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Cita no encontrada"), { status: 404 });
    await audit({ idUsuario: usuario.id, accion: "CITA_ESTADO_ACTUALIZADO", tabla: "citas", registroId: Number(id), detalle: { estado: data.estado }, req });
    return result.rows[0];
};

exports.registrarPagoPrevio = async (id, data, usuario, req) => {
    const monto = Number(data.monto);
    const formas = ["Efectivo", "Tarjeta", "Transferencia", "Credito", "Mixto"];
    if (!Number.isFinite(monto) || monto <= 0) throw Object.assign(new Error("El monto debe ser mayor a cero"), { status: 400 });
    if (!formas.includes(data.forma_pago)) throw Object.assign(new Error("Forma de pago inválida"), { status: 400 });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const cita = await client.query("SELECT * FROM citas WHERE id_cita=$1 FOR UPDATE", [id]);
        if (!cita.rows[0]) throw Object.assign(new Error("Cita no encontrada"), { status: 404 });
        if (["Cancelada", "Atendida"].includes(cita.rows[0].estado)) throw Object.assign(new Error("La cita no admite pagos"), { status: 409 });
        const pago = await client.query(
            `INSERT INTO pagos_previos(id_cita,id_usuario,monto,forma_pago,referencia)
             VALUES($1,$2,$3,$4,$5) RETURNING *`,
            [id,usuario.id,monto,data.forma_pago,String(data.referencia || "").trim() || null]
        );
        await client.query("UPDATE citas SET pago_previo=TRUE,estado='Pagada',actualizado_en=NOW() WHERE id_cita=$1", [id]);
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "PAGO_PREVIO_REGISTRADO", tabla: "pagos_previos", registroId: pago.rows[0].id_pago_previo, detalle: { id_cita: Number(id), monto, forma_pago: data.forma_pago }, req });
        return pago.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};

exports.cancelar = async (id, usuario, req) => exports.actualizarEstado(id, { estado: "Cancelada" }, usuario, req);
