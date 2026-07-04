const pool = require("../../config/database");

const validar = (data) => {
    const requerido = (mensaje) => Object.assign(new Error(mensaje),{status:400});
    if (!String(data.nombre || "").trim()) throw requerido("El nombre es obligatorio");
    if (!String(data.apellido || "").trim()) throw requerido("El apellido es obligatorio");
    if (!String(data.cedula || "").trim()) throw requerido("La cedula es obligatoria");
};

exports.obtener = async () => (await pool.query(
    "SELECT * FROM pacientes ORDER BY id_paciente DESC"
)).rows;

exports.crear = async (data) => {
    validar(data);
    const result = await pool.query(
        `INSERT INTO pacientes
         (nombre,apellido,cedula,telefono,fecha_nacimiento,correo,direccion)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [data.nombre.trim(),data.apellido.trim(),data.cedula.trim(),data.telefono||null,
         data.fecha_nacimiento||null,data.correo?.trim()||null,data.direccion?.trim()||null]
    );
    return result.rows[0];
};

exports.actualizar = async (id, data) => {
    validar(data);
    const result = await pool.query(
        `UPDATE pacientes SET nombre=$1,apellido=$2,cedula=$3,telefono=$4,
         fecha_nacimiento=$5,correo=$6,direccion=$7 WHERE id_paciente=$8 RETURNING *`,
        [data.nombre.trim(),data.apellido.trim(),data.cedula.trim(),data.telefono||null,
         data.fecha_nacimiento||null,data.correo?.trim()||null,data.direccion?.trim()||null,id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Paciente no encontrado"),{status:404});
    return result.rows[0];
};

exports.eliminar = async (id) => {
    const result = await pool.query("DELETE FROM pacientes WHERE id_paciente=$1 RETURNING *",[id]);
    if (!result.rows[0]) throw Object.assign(new Error("Paciente no encontrado"),{status:404});
    return result.rows[0];
};
