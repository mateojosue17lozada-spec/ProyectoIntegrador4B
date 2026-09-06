const pool = require("../../config/database");
const audit = require("../../utils/audit");
const { encrypt, decrypt } = require("../../utils/sensitiveCrypto");
const { verificarPagoCita } = require("../../utils/clinicalFlow");

const secciones = [
    "motivo", "anamnesis_general", "antecedentes_personales_oculares",
    "antecedentes_personales_generales", "antecedentes_familiares_oculares",
    "antecedentes_familiares_generales", "lensometria", "agudeza_visual",
    "examen_externo", "reflejos_pupilares", "oftalmoscopia", "examen_motor",
    "queratometria_refraccion", "observaciones_patologicas", "tratamiento"
];

const contenido = (data) => Object.fromEntries(secciones.map((campo) => [campo, data[campo] ?? null]));

const validarEstructuraClinica = (data) => {
    if (data.lensometria && typeof data.lensometria !== 'object') {
        throw Object.assign(new Error("La lensometría debe ser un objeto estructurado"), { status: 400 });
    }
    if (data.agudeza_visual && typeof data.agudeza_visual !== 'object') {
        throw Object.assign(new Error("La agudeza visual debe ser un objeto estructurado"), { status: 400 });
    }
};

const expandir = (row) => {
    let datos = {};
    try { datos = decrypt(row.datos_encriptados); } catch { datos = {}; }
    const { datos_encriptados, ...safe } = row;
    return { ...safe, ...datos };
};

const validarCie10 = async (codigo, client = pool) => {
    if (!codigo) return;
    const result = await client.query("SELECT 1 FROM cie10_catalogo WHERE codigo=$1 AND activo=TRUE", [codigo]);
    if (!result.rowCount) throw Object.assign(new Error(`El diagnóstico CIE-10 ${codigo} no pertenece al catálogo`), { status: 400 });
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
                (h.estado = 'Finalizada' AND (h.bloqueada OR NOW()>h.editable_hasta)) bloqueada_legal
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
                (h.estado = 'Finalizada' AND (h.bloqueada OR NOW()>h.editable_hasta)) bloqueada_legal
         FROM historias_clinicas h JOIN pacientes p USING(id_paciente)
         LEFT JOIN usuarios u ON u.id_usuario=h.id_optometra WHERE h.id_historia=$1`, [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Historia clínica no encontrada"), { status: 404 });
    const historia = expandir(result.rows[0]);
    
    const diagnosticos = await pool.query(`SELECT id_diagnostico, codigo_cie10, tipo, observacion FROM historia_diagnosticos WHERE id_historia=$1`, [id]);
    historia.diagnosticos = diagnosticos.rows;

    const adendas = await pool.query(`SELECT a.id_adenda, a.contenido, a.creado_en, u.nombre, u.apellido 
                                      FROM historia_adendas a JOIN usuarios u USING(id_usuario) 
                                      WHERE a.id_historia=$1 ORDER BY a.creado_en ASC`, [id]);
    historia.adendas = adendas.rows;

    return historia;
};

exports.crear = async (data, usuario, req) => {
    if (!data.id_paciente) throw Object.assign(new Error("El paciente es obligatorio"), { status: 400 });
    validarEstructuraClinica(data);
    
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await verificarPagoCita(data.id_cita, data.id_paciente, client);
        
        const result = await client.query(
            `INSERT INTO historias_clinicas(id_paciente,id_cita,id_optometra,
             datos_encriptados,consultorio,consentimiento_informado,firma_paciente,nombre_examinador,nivel_paralelo,jornada,estado)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Borrador') RETURNING *`,
            [data.id_paciente,data.id_cita,usuario.id,encrypt(contenido(data)),data.consultorio || null,
             data.consentimiento_informado === true,data.firma_paciente || null,
             data.nombre_examinador || `${usuario.nombre || ""}`.trim(),data.nivel_paralelo || null,data.jornada || null]
        );
        const id_historia = result.rows[0].id_historia;

        if (data.diagnosticos && Array.isArray(data.diagnosticos)) {
            for (const diag of data.diagnosticos) {
                await validarCie10(diag.codigo, client);
                await client.query(
                    `INSERT INTO historia_diagnosticos(id_historia, codigo_cie10, tipo, observacion) VALUES ($1, $2, $3, $4)`,
                    [id_historia, diag.codigo, diag.tipo || 'Secundario', diag.observacion || null]
                );
            }
        }

        await client.query("UPDATE citas SET estado='En atención',actualizado_en=NOW() WHERE id_cita=$1", [data.id_cita]);
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "HISTORIA_CREADA", tabla: "historias_clinicas", registroId: id_historia, req, client: pool });
        return exports.obtener(id_historia);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};

exports.actualizar = async (id, data, usuario, req) => {
    validarEstructuraClinica(data);
    
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const previa = await client.query("SELECT estado FROM historias_clinicas WHERE id_historia=$1 FOR UPDATE", [id]);
        if (!previa.rows[0]) throw Object.assign(new Error("Historia clínica no encontrada"), { status: 404 });

        // Editar una historia FINALIZADA exige registrar el motivo (Diana). En
        // borrador aun se esta redactando, no hace falta.
        const observacion = String(data.observacion || "").trim();
        if (previa.rows[0].estado === "Finalizada" && !observacion) {
            throw Object.assign(new Error("Debe registrar el motivo de la edición"), { status: 400 });
        }

        // Si la historia esta bloqueada por las 24 h, este UPDATE dispara el
        // trigger (P0001), que utils/http.js traduce a un 409 con mensaje claro.
        const result = await client.query(
            `UPDATE historias_clinicas SET datos_encriptados=$1,actualizado_en=NOW(),
             consultorio=$2,consentimiento_informado=$3,firma_paciente=$4,nombre_examinador=$5,
             nivel_paralelo=$6,jornada=$7 WHERE id_historia=$8 RETURNING *`,
            [encrypt(contenido(data)),data.consultorio || null,data.consentimiento_informado === true,
             data.firma_paciente || null,data.nombre_examinador || usuario.nombre,data.nivel_paralelo || null,
             data.jornada || null,id]
        );
        if (!result.rows[0]) throw Object.assign(new Error("Historia clínica no encontrada o no editable"), { status: 404 });

        if (data.diagnosticos && Array.isArray(data.diagnosticos)) {
            await client.query("DELETE FROM historia_diagnosticos WHERE id_historia=$1", [id]);
            for (const diag of data.diagnosticos) {
                await validarCie10(diag.codigo, client);
                await client.query(
                    `INSERT INTO historia_diagnosticos(id_historia, codigo_cie10, tipo, observacion) VALUES ($1, $2, $3, $4)`,
                    [id, diag.codigo, diag.tipo || 'Secundario', diag.observacion || null]
                );
            }
        }

        // Historial de cambios: los datos clinicos van cifrados, asi que se
        // registra el motivo y el campo, no el texto en claro.
        await client.query(
            `INSERT INTO historia_ediciones(id_historia, id_usuario, campo_modificado, observacion)
             VALUES ($1, $2, 'datos_clinicos', $3)`,
            [id, usuario.id, observacion || "Actualización de historia"]
        );

        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "HISTORIA_ACTUALIZADA", tabla: "historias_clinicas", registroId: Number(id), detalle: { observacion: observacion || null }, req, client: pool });
        return exports.obtener(id);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};

/**
 * Desbloqueo autorizado por un administrador (Diana): reabre por 2 h una
 * historia finalizada y bloqueada por las 24 h, para que pueda corregirse. Exige
 * motivo, queda auditado y registrado en el historial de ediciones. Usa el
 * bypass del trigger solo dentro de esta transaccion.
 */
exports.desbloquear = async (id, data, usuario, req) => {
    const observacion = String(data.observacion || "").trim();
    if (!observacion) throw Object.assign(new Error("Debe indicar el motivo de la autorización"), { status: 400 });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL app.bypass_bloqueo_historia = 'on'");
        const r = await client.query(
            `UPDATE historias_clinicas
             SET bloqueada = FALSE, editable_hasta = NOW() + INTERVAL '2 hours', actualizado_en = NOW()
             WHERE id_historia = $1 AND estado = 'Finalizada' RETURNING id_historia`,
            [id]
        );
        if (!r.rows[0]) throw Object.assign(new Error("Historia no encontrada o no está finalizada"), { status: 404 });

        await client.query(
            `INSERT INTO historia_ediciones(id_historia, id_usuario, campo_modificado, observacion, autorizada_por)
             VALUES ($1, $2, 'desbloqueo', $3, $2)`,
            [id, usuario.id, observacion]
        );
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "HISTORIA_DESBLOQUEADA", tabla: "historias_clinicas", registroId: Number(id), detalle: { observacion }, req });
        return { mensaje: "Historia desbloqueada para edición durante 2 horas", editable_hasta_horas: 2 };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};

/** Historial de ediciones de una historia clinica (para mostrar los cambios). */
exports.historialEdiciones = async (id) => {
    const r = await pool.query(
        `SELECT e.id_edicion, e.campo_modificado, e.observacion, e.fecha,
                concat_ws(' ', u.nombre, u.apellido) AS usuario,
                concat_ws(' ', a.nombre, a.apellido) AS autorizada_por
         FROM historia_ediciones e
         LEFT JOIN usuarios u ON u.id_usuario = e.id_usuario
         LEFT JOIN usuarios a ON a.id_usuario = e.autorizada_por
         WHERE e.id_historia = $1
         ORDER BY e.fecha DESC`,
        [id]
    );
    return r.rows;
};

exports.finalizar = async (id, usuario, req) => {
    const result = await pool.query(
        `UPDATE historias_clinicas SET estado='Finalizada', finalizada_en=NOW(), editable_hasta=(NOW() + INTERVAL '24 hours'), actualizado_en=NOW()
         WHERE id_historia=$1 AND estado='Borrador' AND consentimiento_informado=TRUE AND NULLIF(TRIM(firma_paciente),'') IS NOT NULL
         RETURNING *`, [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Debe registrar consentimiento y firma antes de finalizar la historia (o ya está finalizada)"), { status: 409 });
    await audit({ idUsuario: usuario.id, accion: "HISTORIA_FINALIZADA", tabla: "historias_clinicas", registroId: Number(id), req });
    return exports.obtener(id);
};

exports.agregarAdenda = async (id, data, usuario, req) => {
    if (!data.contenido) throw Object.assign(new Error("El contenido de la adenda es obligatorio"), { status: 400 });
    
    // Solo permitir adendas a historias bloqueadas/finalizadas
    const historia = await pool.query(`SELECT estado, bloqueada, editable_hasta FROM historias_clinicas WHERE id_historia=$1`, [id]);
    if (!historia.rows[0]) throw Object.assign(new Error("Historia no encontrada"), { status: 404 });
    const { estado, bloqueada, editable_hasta } = historia.rows[0];
    
    if (estado !== 'Finalizada' || (!bloqueada && new Date() <= new Date(editable_hasta))) {
        throw Object.assign(new Error("No se pueden agregar adendas a una historia que aún es editable, actualice directamente la historia"), { status: 409 });
    }

    const result = await pool.query(
        `INSERT INTO historia_adendas(id_historia, id_usuario, contenido) VALUES ($1, $2, $3) RETURNING *`,
        [id, usuario.id, data.contenido]
    );
    
    await audit({ idUsuario: usuario.id, accion: "ADENDA_AGREGADA", tabla: "historia_adendas", registroId: result.rows[0].id_adenda, req });
    return exports.obtener(id);
};
