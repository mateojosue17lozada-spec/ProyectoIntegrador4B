const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth.middleware");
const controller = require("./citas.controller");
const responder = require("../../utils/http");
const service = require("./citas.service");
const rol = require("../../middleware/rol.middleware");
const pool = require("../../config/database");

// Obtener profesionales (incluye rol Paciente)
router.get("/profesionales", auth, rol(["Administrador", "Optometra", "Cajero", "Vendedor", "Paciente"]), responder(() => service.profesionales()));

// Consultar disponibilidad de un profesional en fecha determinada
router.get("/disponibilidad", auth, rol(["Administrador", "Optometra", "Cajero", "Vendedor", "Paciente"]), responder((req) => service.disponibilidad(req.query.id_usuario, req.query.fecha_cita)));


// Citas del paciente logueado (busca por correo, cédula o coincidencia de nombre/apellido)
router.get("/mis-citas", auth, rol(["Paciente"]), responder(async (req) => {
    const p = await pool.query(
        `SELECT id_paciente FROM pacientes 
         WHERE correo = $1 OR (cedula IS NOT NULL AND cedula <> '' AND cedula = $2)
            OR (LOWER(nombre) = LOWER($3) AND LOWER(apellido) = LOWER($4))`,
        [req.usuario.correo, req.usuario.cedula || '', req.usuario.nombre || '', req.usuario.apellido || '']
    );
    if (!p.rows.length) return [];
    const ids = p.rows.map(r => r.id_paciente);
    return (await pool.query(
        `SELECT c.*, concat_ws(' ', u.nombre, u.apellido) AS profesional_nombre,
                COALESCE(SUM(pp.monto), 0) total_pagado
         FROM citas c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
         LEFT JOIN pagos_previos pp USING(id_cita)
         WHERE c.id_paciente = ANY($1::int[])
         GROUP BY c.id_cita, u.nombre, u.apellido
         ORDER BY c.fecha_cita DESC, c.hora_cita DESC
         LIMIT 30`,
        [ids]
    )).rows;
}));

// Paciente agenda su propia cita
router.post("/mis-citas", auth, rol(["Paciente"]), responder(async (req) => {
    // Buscar o crear registro de paciente
    let p = await pool.query("SELECT id_paciente FROM pacientes WHERE correo=$1 OR (cedula IS NOT NULL AND cedula <> '' AND cedula=$2)", [req.usuario.correo, req.usuario.cedula || '']);
    let id_paciente = p.rows[0]?.id_paciente;
    if (!id_paciente) {
        const u = await pool.query("SELECT * FROM usuarios WHERE id_usuario=$1", [req.usuario.id]);
        const row = u.rows[0];
        const p2 = await pool.query(
            "INSERT INTO pacientes(nombre,apellido,correo,cedula,telefono,fecha_nacimiento,genero,ocupacion,lugar_nacimiento,direccion) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,'Otro','Sin especificar','Sin especificar','Sin especificar') RETURNING id_paciente",
            [row.nombre, row.apellido || '', row.correo, row.cedula || '0000000000', row.telefono || '0000000000']
        );
        id_paciente = p2.rows[0].id_paciente;
    }
    return service.crear({ ...req.body, id_paciente });
}, 201));

// Paciente me cancela su cita
router.post("/mis-citas/:id/cancelar", auth, rol(["Paciente"]), responder(async (req) => {
    const { id } = req.params;
    const cita = await pool.query("SELECT * FROM citas WHERE id_cita=$1", [id]);
    if (!cita.rows[0]) throw Object.assign(new Error("Cita no encontrada"), { status: 404 });
    if (cita.rows[0].estado === "Cancelada") throw Object.assign(new Error("La cita ya está cancelada"), { status: 400 });
    return service.actualizarEstado(id, { estado: "Cancelada", motivo_cancelacion: req.body.motivo || "Cancelada por el paciente" }, req.usuario, req);
}));

// Paciente reagenda su cita
router.post("/mis-citas/:id/reagendar", auth, rol(["Paciente"]), responder(async (req) => {
    const { id } = req.params;
    const { fecha_cita, hora_cita } = req.body;
    if (!fecha_cita || !hora_cita) throw Object.assign(new Error("Nueva fecha y hora son requeridas"), { status: 400 });

    const hoyStr = new Date().toISOString().slice(0, 10);
    if (fecha_cita < hoyStr) {
        throw Object.assign(new Error("No se pueden agendar citas en fechas pasadas"), { status: 400 });
    }
    if (fecha_cita === hoyStr) {
        const ahoraHora = new Date().toTimeString().slice(0, 5);
        if (hora_cita < ahoraHora) {
            throw Object.assign(new Error("No se pueden agendar citas en horas pasadas del día de hoy"), { status: 400 });
        }
    }

    const cita = await pool.query("SELECT * FROM citas WHERE id_cita=$1", [id]);
    if (!cita.rows[0]) throw Object.assign(new Error("Cita no encontrada"), { status: 404 });
    if (["Cancelada", "Atendida"].includes(cita.rows[0].estado)) {
        throw Object.assign(new Error(`No se puede reagendar una cita ${cita.rows[0].estado}`), { status: 400 });
    }

    // Verificar conflicto de horario
    const conflicto = await pool.query(
        `SELECT 1 FROM citas WHERE id_usuario=$1 AND fecha_cita=$2 AND hora_cita=$3
         AND estado NOT IN ('Cancelada','No asistio') AND id_cita <> $4 LIMIT 1`,
        [cita.rows[0].id_usuario, fecha_cita, hora_cita, id]
    );
    if (conflicto.rowCount) throw Object.assign(new Error("Ya existe una cita en ese horario con el profesional"), { status: 409 });

    const res = await pool.query(
        "UPDATE citas SET fecha_cita=$1, hora_cita=$2, actualizado_en=NOW() WHERE id_cita=$3 RETURNING *",
        [fecha_cita, hora_cita, id]
    );
    return res.rows[0];
}));

// Obtener citas (Staff)
router.get("/", auth, rol(["Administrador", "Optometra", "Cajero", "Vendedor"]), controller.obtener);

// Crear cita (Staff)
router.post("/", auth, rol(["Administrador", "Cajero", "Vendedor"]), controller.crear);

router.patch("/:id", auth, rol(["Administrador", "Optometra", "Cajero", "Vendedor"]), responder((req) => service.actualizarEstado(req.params.id, req.body, req.usuario, req)));
router.post("/:id/pago-previo", auth, rol(["Administrador", "Cajero"]), responder((req) => service.registrarPagoPrevio(req.params.id, req.body, req.usuario, req), 201));
router.delete("/:id", auth, rol(["Administrador"]), responder((req) => service.cancelar(req.params.id, req.usuario, req)));

module.exports = router;
