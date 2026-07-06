const pool = require("../../config/database");

const campos = [
    "nombre", "apellido", "cedula", "telefono", "correo", "direccion",
    "fecha_nacimiento", "lugar_nacimiento", "genero", "ocupacion",
    "procedencia", "uso_lentes", "ultimo_control"
];

const validar = (data) => {
    for (const campo of ["nombre", "apellido", "cedula"]) {
        if (!String(data[campo] || "").trim()) {
            throw Object.assign(new Error(`${campo} es obligatorio`), { status: 400 });
        }
    }
    if (data.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) {
        throw Object.assign(new Error("Correo inválido"), { status: 400 });
    }
};

exports.obtener = async () => (await pool.query(
    "SELECT * FROM pacientes WHERE activo=TRUE ORDER BY apellido,nombre"
)).rows;

exports.crear = async (data) => {
    validar(data);
    const values = campos.map((campo) => {
        if (campo === "uso_lentes") return data[campo] === true || data[campo] === "true";
        return typeof data[campo] === "string" ? data[campo].trim() || null : data[campo] ?? null;
    });
    const result = await pool.query(
        `INSERT INTO pacientes(${campos.join(",")})
         VALUES(${campos.map((_, index) => `$${index + 1}`).join(",")}) RETURNING *`, values
    );
    return result.rows[0];
};

exports.actualizar = async (id, data) => {
    validar(data);
    const values = campos.map((campo) => {
        if (campo === "uso_lentes") return data[campo] === true || data[campo] === "true";
        return typeof data[campo] === "string" ? data[campo].trim() || null : data[campo] ?? null;
    });
    const set = campos.map((campo, index) => `${campo}=$${index + 1}`).join(",");
    const result = await pool.query(
        `UPDATE pacientes SET ${set} WHERE id_paciente=$${campos.length + 1} AND activo=TRUE RETURNING *`,
        [...values, id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Paciente no encontrado"), { status: 404 });
    return result.rows[0];
};

exports.eliminar = async (id) => {
    const result = await pool.query(
        "UPDATE pacientes SET activo=FALSE WHERE id_paciente=$1 AND activo=TRUE RETURNING *", [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Paciente no encontrado"), { status: 404 });
    return result.rows[0];
};
