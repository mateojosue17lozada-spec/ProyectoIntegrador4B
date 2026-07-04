const pool = require("../../config/database");
const registrarAuditoria = require("../../utils/audit");
const { encrypt, decrypt } = require("../../utils/sensitiveCrypto");

const campos = [
    "motivo", "antecedentes_personales", "antecedentes_familiares",
    "antecedentes_oculares", "lensometria", "agudeza_visual",
    "examen_externo", "reflejos_pupilares", "oftalmoscopia",
    "diagnostico_cie10", "diagnostico_descripcion", "examen_motor",
    "observaciones_patologicas", "tratamiento"
];

exports.listar = async (idPaciente) => {
    const values = [];
    const filtro = idPaciente ? "WHERE h.id_paciente = $1" : "";
    if (idPaciente) values.push(idPaciente);
    const result = await pool.query(
        `SELECT h.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
                u.nombre AS optometra_nombre,
                (h.bloqueada OR NOW() > h.editable_hasta) AS bloqueada_legal
         FROM historias_clinicas h
         JOIN pacientes p ON p.id_paciente = h.id_paciente
         LEFT JOIN usuarios u ON u.id_usuario = h.id_optometra
         ${filtro} ORDER BY h.creado_en DESC`, values
    );
    return result.rows.map((row) => ({ ...row, ...decrypt(row.datos_encriptados), datos_encriptados: undefined }));
};

exports.obtener = async (id) => {
    const result = await pool.query(
        `SELECT h.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
                (h.bloqueada OR NOW() > h.editable_hasta) AS bloqueada_legal
         FROM historias_clinicas h JOIN pacientes p USING (id_paciente)
         WHERE h.id_historia = $1`, [id]
    );
    if (!result.rows[0]) throw new Error("Historia clinica no encontrada");
    return { ...result.rows[0], ...decrypt(result.rows[0].datos_encriptados), datos_encriptados: undefined };
};

exports.crear = async (data, usuario, req) => {
    if (!data.id_paciente) throw new Error("El paciente es obligatorio");
    const contenido = Object.fromEntries(campos.map((campo) => [campo, data[campo] || (campo === "lensometria" || campo === "agudeza_visual" ? {} : null)]));
    const result = await pool.query(
        `INSERT INTO historias_clinicas(id_paciente,id_cita,id_optometra,diagnostico_cie10,datos_encriptados)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [data.id_paciente, data.id_cita || null, usuario.id, data.diagnostico_cie10 || null, encrypt(contenido)]
    );
    await registrarAuditoria({ idUsuario: usuario.id, accion: "HISTORIA_CREADA", tabla: "historias_clinicas", registroId: result.rows[0].id_historia, req });
    return result.rows[0];
};

exports.actualizar = async (id, data, usuario, req) => {
    const contenido = Object.fromEntries(campos.map((campo) => [campo, data[campo] || (campo === "lensometria" || campo === "agudeza_visual" ? {} : null)]));
    const result = await pool.query(
        `UPDATE historias_clinicas SET diagnostico_cie10=$1, datos_encriptados=$2, actualizado_en=NOW()
         WHERE id_historia=$3 RETURNING *`, [data.diagnostico_cie10 || null, encrypt(contenido), id]
    );
    if (!result.rows[0]) throw new Error("Historia clinica no encontrada");
    await registrarAuditoria({ idUsuario: usuario.id, accion: "HISTORIA_ACTUALIZADA", tabla: "historias_clinicas", registroId: Number(id), req });
    return result.rows[0];
};

exports.bloquear = async (id, usuario, req) => {
    const result = await pool.query(
        "UPDATE historias_clinicas SET bloqueada = TRUE WHERE id_historia = $1 RETURNING *", [id]
    );
    if (!result.rows[0]) throw new Error("Historia clinica no encontrada");
    await registrarAuditoria({ idUsuario: usuario.id, accion: "HISTORIA_BLOQUEADA", tabla: "historias_clinicas", registroId: Number(id), req });
    return result.rows[0];
};
