const pool = require("../config/database");

const verificarPagoCita = async (idCita, idPaciente, client = pool) => {
    if (!idCita) throw Object.assign(new Error("La atención requiere una cita"), { status: 400 });
    const result = await client.query(
        `SELECT c.id_cita,c.id_paciente,c.estado,c.pago_previo,COALESCE(SUM(p.monto),0) total_pagado
         FROM citas c LEFT JOIN pagos_previos p USING(id_cita)
         WHERE c.id_cita=$1 GROUP BY c.id_cita`,
        [idCita]
    );
    const cita = result.rows[0];
    if (!cita) throw Object.assign(new Error("Cita no encontrada"), { status: 404 });
    if (Number(cita.id_paciente) !== Number(idPaciente)) {
        throw Object.assign(new Error("La cita no corresponde al paciente"), { status: 409 });
    }
    if (!cita.pago_previo || Number(cita.total_pagado) <= 0) {
        throw Object.assign(new Error("Debe confirmar el pago previo antes de iniciar la atención"), { status: 402 });
    }
    if (["Cancelada", "No asistio"].includes(cita.estado)) {
        throw Object.assign(new Error("La cita no está disponible para atención"), { status: 409 });
    }
    return cita;
};

module.exports = { verificarPagoCita };
