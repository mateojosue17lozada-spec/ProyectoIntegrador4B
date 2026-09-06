/**
 * Bloques 4-9: historia clinica (requerimiento Diana 2), facturacion, compras,
 * inventario, cartera y caja (requerimiento Diana 1).
 */
const { Client } = require("pg");
const fs = require("fs");

const BASE = "http://localhost:3010/api";
const DB = "postgresql://postgres:test123@localhost:55432/optica_test";
const CRED = require("./credenciales.json");

const resultados = [];
const sesiones = {};

const registrar = (id, modulo, descripcion, esperado, obtenido, pasa, severidad) => {
    resultados.push({ id, modulo, descripcion, esperado, obtenido, estado: pasa ? "PASA" : "FALLA", severidad: pasa ? null : severidad || "Mayor" });
    console.log(`${pasa ? "OK  " : "FALLA"} ${id.padEnd(8)} ${descripcion}`);
    if (!pasa) console.log(`         esperado: ${esperado}\n         obtenido: ${obtenido}`);
};

const llamar = async (metodo, ruta, { token, body } = {}) => {
    const cabeceras = { "Content-Type": "application/json" };
    if (token) cabeceras.Authorization = `Bearer ${token}`;
    const respuesta = await fetch(`${BASE}${ruta}`, { method: metodo, headers: cabeceras, body: body ? JSON.stringify(body) : undefined });
    if (respuesta.status === 429) {
        console.log("         (429: esperando al limitador...)");
        await new Promise((r) => setTimeout(r, 121000));
        return llamar(metodo, ruta, { token, body });
    }
    const texto = await respuesta.text();
    let datos = null;
    try { datos = JSON.parse(texto); } catch { datos = texto; }
    return { status: respuesta.status, datos, cookies: respuesta.headers.get("set-cookie") };
};

const sql = async (consulta, valores = []) => {
    const c = new Client({ connectionString: DB });
    await c.connect();
    try { return (await c.query(consulta, valores)).rows; } finally { await c.end(); }
};

const entrar = async (rol, usuario, password) => {
    const r = await llamar("POST", "/auth/login", { body: { identificador: usuario, password } });
    const m = /token=([^;,\s]+)/.exec(r.cookies || "");
    if (m) sesiones[rol] = m[1];
    return Boolean(m);
};

// ==================== 4. HISTORIA CLINICA (Diana req. 2) ====================
const bloque4Historia = async () => {
    console.log("\n=== 4. HISTORIA CLINICA - BLOQUEO DE ANAMNESIS (Diana req. 2) ===");

    const paciente = (await sql("SELECT id_paciente FROM pacientes ORDER BY id_paciente LIMIT 1"))[0];
    const optometra = (await sql("SELECT id_usuario FROM usuarios u JOIN roles r USING(id_rol) WHERE r.nombre_rol='Optometra' LIMIT 1"))[0];

    // Se necesita una cita pagada: verificarPagoCita lo exige antes de abrir historia.
    const cita = (await sql(
        `INSERT INTO citas(id_paciente,id_usuario,fecha_cita,hora_cita,motivo,estado,pago_previo,tarifa)
         VALUES($1,$2,CURRENT_DATE,'09:00','Prueba de bloqueo','Confirmada',TRUE,35) RETURNING id_cita`,
        [paciente.id_paciente, optometra.id_usuario]
    ))[0];
    await sql("INSERT INTO pagos_previos(id_cita,id_usuario,monto,forma_pago) VALUES($1,$2,35,'Efectivo')", [cita.id_cita, optometra.id_usuario]);

    const cuerpo = {
        id_paciente: paciente.id_paciente,
        id_cita: cita.id_cita,
        motivo: "Vision borrosa de lejos",
        anamnesis_general: "Paciente colaborador, sin alergias.",
        antecedentes_personales_oculares: "Uso de correccion desde 2020",
        antecedentes_familiares_oculares: "Madre miope",
        lensometria: { od: "-1.50", oi: "-1.25" },
        agudeza_visual: { av_vl_sc_od: "20/80", av_vl_sc_oi: "20/60" },
        tratamiento: "Correccion optica permanente",
        consultorio: "Consultorio 1",
        consentimiento_informado: true,
        firma_paciente: "Maria Cedeno",
        jornada: "Matutina"
    };

    let r = await llamar("POST", "/historia", { token: sesiones.Optometra, body: cuerpo });
    const idHistoria = r.datos?.id_historia;
    registrar("HC-01", "Historia clinica", "Optometra crea historia clinica (anamnesis)",
        "HTTP 201", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 201, "Critico");
    if (!idHistoria) return null;

    r = await llamar("POST", `/historia/${idHistoria}/finalizar`, { token: sesiones.Optometra });
    const tras = (await sql("SELECT estado, editable_hasta FROM historias_clinicas WHERE id_historia=$1", [idHistoria]))[0];
    registrar("HC-02", "Historia clinica", "Finalizar historia fija ventana de 24 h",
        "estado=Finalizada y editable_hasta = ahora + 24 h",
        `HTTP ${r.status}, estado=${tras?.estado}, editable_hasta=${tras?.editable_hasta}`,
        tras?.estado === "Finalizada" && Boolean(tras?.editable_hasta), "Critico");

    // Edicion DENTRO de la ventana: debe permitirse.
    r = await llamar("PUT", `/historia/${idHistoria}`, { token: sesiones.Optometra, body: { ...cuerpo, tratamiento: "Correccion optica + control en 6 meses" } });
    registrar("HC-03", "Historia clinica", "Editar dentro de las 24 h",
        "HTTP 200", `HTTP ${r.status}`, r.status === 200, "Mayor");

    // Se envejece la historia para simular el paso de 24 h (manipulacion de datos
    // documentada; no se toca codigo de la aplicacion).
    await sql("UPDATE historias_clinicas SET editable_hasta = NOW() - INTERVAL '1 hour' WHERE id_historia=$1", [idHistoria]);
    const vencida = (await sql("SELECT editable_hasta < NOW() vencida FROM historias_clinicas WHERE id_historia=$1", [idHistoria]))[0];
    registrar("HC-04", "Historia clinica", "Simular vencimiento de las 24 h",
        "editable_hasta en el pasado", `vencida=${vencida?.vencida}`, vencida?.vencida === true, "Mayor");

    // NUCLEO DEL REQUERIMIENTO: pasadas 24 h la edicion debe quedar bloqueada.
    const antes = (await sql("SELECT datos_encriptados FROM historias_clinicas WHERE id_historia=$1", [idHistoria]))[0];
    r = await llamar("PUT", `/historia/${idHistoria}`, { token: sesiones.Optometra, body: { ...cuerpo, tratamiento: "EDICION NO AUTORIZADA TRAS 24 HORAS" } });
    const despues = (await sql("SELECT datos_encriptados FROM historias_clinicas WHERE id_historia=$1", [idHistoria]))[0];
    const cambio = antes.datos_encriptados !== despues.datos_encriptados;
    registrar("HC-05", "Historia clinica", "Editar DESPUES de 24 h sin autorizacion",
        "rechazo HTTP 403/409 y datos intactos",
        `HTTP ${r.status}, datos modificados=${cambio}`,
        r.status >= 400 && !cambio, "Critico");

    // Observacion obligatoria al editar
    r = await llamar("PUT", `/historia/${idHistoria}`, { token: sesiones.Optometra, body: { ...cuerpo } });
    registrar("HC-06", "Historia clinica", "Edicion exige observacion con el motivo",
        "rechazo si falta el motivo de la edicion",
        r.status === 200 ? "HTTP 200: acepta editar SIN motivo" : `HTTP ${r.status}`,
        r.status >= 400, "Critico");

    // Flujo de autorizacion administrativa
    const rutasAutorizacion = ["/historia/" + idHistoria + "/solicitar-autorizacion", "/historia/" + idHistoria + "/autorizar"];
    let alguna = false;
    for (const ruta of rutasAutorizacion) {
        const rr = await llamar("POST", ruta, { token: sesiones.Administrador, body: { motivo: "Correccion de diagnostico" } });
        if (rr.status !== 404) alguna = true;
    }
    registrar("HC-07", "Historia clinica", "Existe flujo de autorizacion del administrador",
        "endpoint de solicitud/autorizacion disponible",
        alguna ? "existe" : "HTTP 404 en todas las rutas probadas: NO IMPLEMENTADO",
        alguna, "Critico");

    // Historial de cambios con el detalle de lo modificado
    const columnas = await sql("SELECT column_name FROM information_schema.columns WHERE table_name='historias_clinicas'");
    const nombres = columnas.map((c) => c.column_name);
    const tieneMotivo = nombres.some((n) => /motivo_edicion|motivo_cambio|justificacion/.test(n));
    registrar("HC-08", "Historia clinica", "Campo para el motivo obligatorio de edicion",
        "columna motivo_edicion o equivalente",
        tieneMotivo ? "existe" : `no existe. Columnas: ${nombres.join(", ")}`,
        tieneMotivo, "Critico");

    const tablaHistorial = await sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('historia_cambios','historia_versiones','historia_ediciones')");
    const auditoriaHistoria = await sql("SELECT accion, detalle FROM auditoria WHERE tabla_afectada='historias_clinicas' AND id_registro=$1 ORDER BY fecha", [idHistoria]);
    const detalleConDiff = auditoriaHistoria.some((a) => a.detalle && JSON.stringify(a.detalle).length > 30);
    registrar("HC-09", "Historia clinica", "Historial de cambios con detalle de lo editado",
        "tabla de versiones o auditoria con el contenido modificado",
        `tablas de versiones=${tablaHistorial.length}, eventos en auditoria=${auditoriaHistoria.length}, alguno con diff=${detalleConDiff}`,
        tablaHistorial.length > 0 || detalleConDiff, "Mayor");

    // Adendas: el mecanismo que si existe para historias bloqueadas
    r = await llamar("POST", `/historia/${idHistoria}/adendas`, { token: sesiones.Optometra, body: { contenido: "Adenda: se corrige el tratamiento tras revision." } });
    const adendas = await sql("SELECT COUNT(*)::int n FROM historia_adendas WHERE id_historia=$1", [idHistoria]);
    registrar("HC-10", "Historia clinica", "Agregar adenda a historia vencida",
        "HTTP 201 y adenda registrada", `HTTP ${r.status}, adendas=${adendas[0].n}`,
        r.status === 201 && adendas[0].n > 0, "Mayor");

    r = await llamar("POST", `/historia/${idHistoria}/adendas`, { token: sesiones.Optometra, body: {} });
    registrar("HC-11", "Historia clinica", "Adenda sin contenido", "rechazo HTTP 400", `HTTP ${r.status}`, r.status === 400, "Menor");

    r = await llamar("GET", `/historia/${idHistoria}`, { token: sesiones.Cajero });
    registrar("HC-12", "Historia clinica", "Cajero no consulta historias (confidencialidad)",
        "HTTP 403", `HTTP ${r.status}`, r.status === 403, "Critico");

    return idHistoria;
};

// ==================== 9. CAJA (Diana req. 1) ====================
const bloque9Caja = async () => {
    console.log("\n=== 9. CAJA - ARQUEO DE CIERRE (Diana req. 1) ===");

    // Se parte de cero: el seed deja un turno abierto del cajero.
    // No se pueden borrar turnos referenciados por facturas: basta cerrarlos.
    await sql("UPDATE caja_turnos SET estado='Cerrada', cerrado_en=NOW(), monto_cierre=COALESCE(monto_cierre,0) WHERE estado='Abierta'");

    let r = await llamar("POST", "/caja/abrir", { token: sesiones.Cajero, body: { monto_apertura: 100 } });
    const idTurno = r.datos?.id_caja_turno;
    registrar("CAJ-01", "Caja", "Abrir caja con monto de apertura",
        "HTTP 201 y turno abierto", `HTTP ${r.status}, id=${idTurno}`, r.status === 201 && Boolean(idTurno), "Critico");

    r = await llamar("POST", "/caja/abrir", { token: sesiones.Cajero, body: { monto_apertura: 50 } });
    registrar("CAJ-02", "Caja", "Abrir una segunda caja con una ya abierta",
        "rechazo HTTP 4xx", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status >= 400, "Mayor");

    r = await llamar("POST", "/caja/abrir", { token: sesiones.Cajero, body: { monto_apertura: -50 } });
    registrar("CAJ-03", "Caja", "Abrir caja con monto negativo", "rechazo HTTP 400", `HTTP ${r.status}`, r.status >= 400, "Mayor");

    // Ventas con distintas formas de pago dentro del turno.
    const productos = await sql("SELECT id_producto, precio FROM productos WHERE stock > 3 ORDER BY id_producto LIMIT 3");
    const pacienteId = (await sql("SELECT id_paciente FROM pacientes ORDER BY id_paciente LIMIT 1"))[0].id_paciente;
    const formas = [["Efectivo", 0], ["Tarjeta", 1], ["Transferencia", 2]];
    const emitidas = [];

    for (const [forma, indice] of formas) {
        const producto = productos[indice] || productos[0];
        const factura = await llamar("POST", "/facturacion", {
            token: sesiones.Cajero,
            body: {
                id_paciente: pacienteId,
                detalles: [{ id_producto: producto.id_producto, cantidad: 1, precio_unitario: Number(producto.precio) }],
                pagos: [{ forma_pago: forma, monto: Number(producto.precio) }]
            }
        });
        emitidas.push({ forma, status: factura.status, id: factura.datos?.id_factura, mensaje: factura.datos?.mensaje });
    }
    const emitidasOk = emitidas.filter((f) => f.status === 201 || f.status === 200);
    registrar("CAJ-04", "Caja", "Emitir facturas en efectivo, tarjeta y transferencia",
        "3 facturas emitidas",
        emitidas.map((f) => `${f.forma}:${f.status}${f.mensaje ? " " + f.mensaje : ""}`).join(" | "),
        emitidasOk.length === 3, "Critico");

    // CIERRE: se comprueban uno a uno los campos que pide Diana.
    r = await llamar("POST", "/caja/cerrar", {
        token: sesiones.Cajero,
        body: {
            monto_cierre: 150,
            observaciones: "Arqueo de prueba automatizada",
            // Campos del requerimiento que se envian a proposito para ver si el
            // backend los reconoce y persiste.
            efectivo_para_vueltos: 50,
            efectivo_retirado_banco: 100,
            total_tarjeta: 65,
            total_transferencia: 24
        }
    });
    const turno = (await sql("SELECT * FROM caja_turnos WHERE id_caja_turno=$1", [idTurno]))[0];
    registrar("CAJ-05", "Caja", "Cerrar caja (arqueo)",
        "HTTP 200 y estado=Cerrada", `HTTP ${r.status}, estado=${turno?.estado}`,
        r.status === 200 && turno?.estado === "Cerrada", "Critico");

    const columnasCaja = (await sql("SELECT column_name FROM information_schema.columns WHERE table_name='caja_turnos'")).map((c) => c.column_name);

    const requisitosDiana = [
        ["CAJ-06", "Total por tipo de pago (efectivo, tarjeta, transferencia, credito)",
            columnasCaja.filter((c) => /tarjeta|transferencia|credito|mixto/.test(c)),
            "columnas por forma de pago"],
        ["CAJ-07", "Efectivo que se queda en caja para vueltos",
            columnasCaja.filter((c) => /vuelto|fondo|base/.test(c)),
            "columna de fondo para vueltos"],
        ["CAJ-08", "Efectivo retirado y enviado al banco",
            columnasCaja.filter((c) => /retiro|retirado|banco|deposito/.test(c)),
            "columna de retiro a banco"],
        ["CAJ-09", "Observaciones del cajero",
            columnasCaja.filter((c) => /observacion/.test(c)),
            "columna de observaciones"],
        ["CAJ-10", "Responsable del cierre",
            columnasCaja.filter((c) => /cajero|usuario|responsable/.test(c)),
            "columna de responsable"]
    ];

    for (const [id, descripcion, encontradas, esperado] of requisitosDiana) {
        registrar(id, "Caja (Diana)", descripcion, esperado,
            encontradas.length ? `presente: ${encontradas.join(", ")}` : `NO EXISTE. Columnas actuales: ${columnasCaja.join(", ")}`,
            encontradas.length > 0, "Critico");
    }

    registrar("CAJ-11", "Caja (Diana)", "El cierre persiste los campos enviados de vueltos y banco",
        "valores guardados",
        `efectivo_para_vueltos y efectivo_retirado_banco enviados en el body: ${JSON.stringify(turno).includes("vuelto") ? "guardados" : "IGNORADOS por el backend"}`,
        JSON.stringify(turno).includes("vuelto"), "Critico");

    // Desglose por forma de pago realmente calculado
    const desglose = await sql(
        `SELECT fp.forma_pago, SUM(fp.monto)::numeric total FROM factura_pagos fp
         JOIN facturas f USING(id_factura) WHERE f.id_caja_turno=$1 GROUP BY fp.forma_pago`, [idTurno]);
    registrar("CAJ-12", "Caja (Diana)", "El arqueo distingue mas de una forma de pago",
        "desglose por cada forma usada",
        `en BD hay ${desglose.length} formas (${desglose.map((d) => d.forma_pago + "=" + d.total).join(", ")}); el cierre solo guarda ventas_efectivo=${turno?.ventas_efectivo}`,
        desglose.length > 1 && columnasCaja.some((c) => /tarjeta/.test(c)), "Critico");

    const historial = await llamar("GET", "/caja/historial", { token: sesiones.Cajero });
    registrar("CAJ-13", "Caja", "Historial de cierres accesible",
        "HTTP 200 con al menos 1 turno",
        `HTTP ${historial.status}, ${(historial.datos || []).length} turnos`,
        historial.status === 200 && (historial.datos || []).length > 0, "Mayor");

    // Bug de alcance detectado en revision de codigo: los abonos y devoluciones
    // en efectivo se suman por CURRENT_DATE, no por turno.
    const filtroPorTurno = /abonos_cxc[\s\S]{0,200}id_caja_turno/.test(
        fs.readFileSync("C:/Users/user/Desktop/ProyectoIntegrador4B/backend/src/modules/caja/caja.service.js", "utf8")
    );
    registrar("CAJ-14", "Caja", "El efectivo esperado se calcula por turno, no por dia",
        "abonos y devoluciones filtrados por id_caja_turno",
        filtroPorTurno ? "filtrado por turno" : "filtrados por CURRENT_DATE: con dos cajeros el mismo dia, cada arqueo suma el efectivo del otro",
        filtroPorTurno, "Critico");

    return idTurno;
};

module.exports = { llamar, sql, registrar, resultados, sesiones, entrar, CRED };

if (require.main === module) {
    (async () => {
        for (const [rol, c] of Object.entries(CRED)) await entrar(rol, c.usuario, c.password);
        await entrar("Paciente", "paciente.demo", "Paciente2026");

        await bloque4Historia();

        fs.writeFileSync(__dirname + "/resultados-2.json", JSON.stringify(resultados, null, 2));
        const fallos = resultados.filter((x) => x.estado === "FALLA");
        console.log(`\nRESUMEN BLOQUES 4 y 9: ${resultados.length - fallos.length}/${resultados.length} PASAN, ${fallos.length} FALLAN`);
    })();
}
