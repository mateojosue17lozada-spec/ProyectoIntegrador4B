const pool = require("../../config/database");
const audit = require("../../utils/audit");
const { encrypt, decrypt } = require("../../utils/sensitiveCrypto");
const { verificarPagoCita } = require("../../utils/clinicalFlow");

const secciones = [
    "motivo", "anamnesis_general", "antecedentes_personales_oculares",
    "antecedentes_personales_generales", "antecedentes_familiares_oculares",
    "antecedentes_familiares_generales", "lensometria", "agudeza_visual",
    "examen_externo", "reflejos_pupilares", "oftalmoscopia", "examen_motor",
    "queratometria_refraccion", "diagnostico", "observaciones_patologicas", "tratamiento"
];

const contenido = (data) => Object.fromEntries(secciones.map((campo) => [campo, data[campo] ?? null]));

const expandir = (row) => {
    let datos = {};
    try { datos = decrypt(row.datos_encriptados); } catch { datos = {}; }
    const { datos_encriptados, ...safe } = row;
    return { ...safe, ...datos };
};

const validarCie10 = async (codigo, client = pool) => {
    if (!codigo) return;
    const result = await client.query("SELECT 1 FROM cie10_catalogo WHERE codigo=$1 AND activo=TRUE", [codigo]);
    if (!result.rowCount) throw Object.assign(new Error("El diagnóstico CIE-10 no pertenece al catálogo"), { status: 400 });
};

exports.cie10 = async (buscar = "") => (await pool.query(
    `SELECT codigo,descripcion FROM cie10_catalogo
     WHERE activo=TRUE AND ($1='' OR codigo ILIKE '%'||$1||'%' OR descripcion ILIKE '%'||$1||'%')
     ORDER BY codigo LIMIT 50`, [String(buscar).trim()]
)).rows;

exports.listar = async (idPaciente) => {
    const values = [];
    const filtro = idPaciente ? "WHERE h.id_paciente=$1" : "";
    if (idPaciente) values.push(idPaciente);
    const result = await pool.query(
        `SELECT h.*,p.nombre paciente_nombre,p.apellido paciente_apellido,p.cedula,p.telefono,
                p.correo,p.direccion,p.fecha_nacimiento,p.lugar_nacimiento,p.genero,p.ocupacion,
                p.procedencia,p.uso_lentes,p.ultimo_control,u.nombre optometra_nombre,u.apellido optometra_apellido,
                (h.bloqueada OR NOW()>h.editable_hasta) bloqueada_legal
         FROM historias_clinicas h JOIN pacientes p USING(id_paciente)
         LEFT JOIN usuarios u ON u.id_usuario=h.id_optometra ${filtro}
         ORDER BY h.creado_en DESC`, values
    );
    return result.rows.map(expandir);
};

exports.obtener = async (id) => {
    const result = await pool.query(
        `SELECT h.*,p.nombre paciente_nombre,p.apellido paciente_apellido,p.cedula,p.telefono,
                p.correo,p.direccion,p.fecha_nacimiento,p.lugar_nacimiento,p.genero,p.ocupacion,
                p.procedencia,p.uso_lentes,p.ultimo_control,u.nombre optometra_nombre,u.apellido optometra_apellido,
                (h.bloqueada OR NOW()>h.editable_hasta) bloqueada_legal
         FROM historias_clinicas h JOIN pacientes p USING(id_paciente)
         LEFT JOIN usuarios u ON u.id_usuario=h.id_optometra WHERE h.id_historia=$1`, [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Historia clínica no encontrada"), { status: 404 });
    return expandir(result.rows[0]);
};

exports.crear = async (data, usuario, req) => {
    if (!data.id_paciente) throw Object.assign(new Error("El paciente es obligatorio"), { status: 400 });
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await verificarPagoCita(data.id_cita, data.id_paciente, client);
        const codigo = data.diagnostico_cie10 || data.diagnostico?.cie10 || null;
        await validarCie10(codigo, client);
        const result = await client.query(
            `INSERT INTO historias_clinicas(id_paciente,id_cita,id_optometra,diagnostico_cie10,
             datos_encriptados,consultorio,consentimiento_informado,firma_paciente,nombre_examinador,nivel_paralelo,jornada)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [data.id_paciente,data.id_cita,usuario.id,codigo,encrypt(contenido(data)),data.consultorio || null,
             data.consentimiento_informado === true,data.firma_paciente || null,
             data.nombre_examinador || `${usuario.nombre || ""}`.trim(),data.nivel_paralelo || null,data.jornada || null]
        );
        await client.query("UPDATE citas SET estado='En atención',actualizado_en=NOW() WHERE id_cita=$1", [data.id_cita]);
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "HISTORIA_CREADA", tabla: "historias_clinicas", registroId: result.rows[0].id_historia, req });
        return expandir(result.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};

exports.actualizar = async (id, data, usuario, req) => {
    const codigo = data.diagnostico_cie10 || data.diagnostico?.cie10 || null;
    await validarCie10(codigo);
    const result = await pool.query(
        `UPDATE historias_clinicas SET diagnostico_cie10=$1,datos_encriptados=$2,actualizado_en=NOW(),
         consultorio=$3,consentimiento_informado=$4,firma_paciente=$5,nombre_examinador=$6,
         nivel_paralelo=$7,jornada=$8 WHERE id_historia=$9 RETURNING *`,
        [codigo,encrypt(contenido(data)),data.consultorio || null,data.consentimiento_informado === true,
         data.firma_paciente || null,data.nombre_examinador || usuario.nombre,data.nivel_paralelo || null,
         data.jornada || null,id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Historia clínica no encontrada"), { status: 404 });
    await audit({ idUsuario: usuario.id, accion: "HISTORIA_ACTUALIZADA", tabla: "historias_clinicas", registroId: Number(id), req });
    return expandir(result.rows[0]);
};

exports.bloquear = async (id, usuario, req) => {
    const result = await pool.query(
        `UPDATE historias_clinicas SET bloqueada=TRUE,actualizado_en=NOW()
         WHERE id_historia=$1 AND consentimiento_informado=TRUE AND NULLIF(TRIM(firma_paciente),'') IS NOT NULL
         RETURNING *`, [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Debe registrar consentimiento y firma antes de cerrar la historia"), { status: 409 });
    await audit({ idUsuario: usuario.id, accion: "HISTORIA_BLOQUEADA", tabla: "historias_clinicas", registroId: Number(id), req });
    return expandir(result.rows[0]);
};
