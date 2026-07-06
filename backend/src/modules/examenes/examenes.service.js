const pool = require("../../config/database");
const { verificarPagoCita } = require("../../utils/clinicalFlow");

exports.obtener = async () => (await pool.query(
    `SELECT e.*,p.nombre AS paciente_nombre,p.apellido AS paciente_apellido,c.estado AS cita_estado
     FROM examen_visual e JOIN pacientes p USING(id_paciente)
     LEFT JOIN citas c USING(id_cita) ORDER BY e.fecha_examen DESC`
)).rows;

exports.crear = async (data) => {
    if (!data.id_paciente || !data.id_cita) throw Object.assign(new Error("Paciente y cita son obligatorios"), { status: 400 });
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await verificarPagoCita(data.id_cita, data.id_paciente, client);
        const result = await client.query(
            `INSERT INTO examen_visual(id_paciente,id_cita,ojo_derecho,ojo_izquierdo,diagnostico,observacion)
             VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
            [data.id_paciente,data.id_cita,data.ojo_derecho || null,data.ojo_izquierdo || null,
             data.diagnostico || null,data.observacion || null]
        );
        await client.query("UPDATE citas SET estado='En atención',actualizado_en=NOW() WHERE id_cita=$1", [data.id_cita]);
        await client.query("COMMIT");
        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};

exports.actualizar = async (id, data) => {
    const result = await pool.query(
        `UPDATE examen_visual SET ojo_derecho=$1,ojo_izquierdo=$2,diagnostico=$3,observacion=$4
         WHERE id_examen=$5 AND fecha_examen > NOW()-INTERVAL '24 hours' RETURNING *`,
        [data.ojo_derecho || null,data.ojo_izquierdo || null,data.diagnostico || null,data.observacion || null,id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Examen no encontrado o fuera del plazo de edición"), { status: 409 });
    return result.rows[0];
};
