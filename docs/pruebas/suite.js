/**
 * Suite de pruebas funcionales contra la API real de ProyectoIntegrador4B.
 * No modifica codigo de la aplicacion: solo consume la API HTTP y, cuando un
 * caso lo exige (envejecer una historia clinica), toca datos vía SQL dejando
 * constancia en el informe.
 */
const { Client } = require("pg");

const BASE = "http://localhost:3010/api";
const DB = "postgresql://postgres:test123@localhost:55432/optica_test";
const CRED = require("./credenciales.json");

const resultados = [];
let sesiones = {};

const registrar = (id, modulo, descripcion, esperado, obtenido, pasa, severidad) => {
    resultados.push({ id, modulo, descripcion, esperado, obtenido, estado: pasa ? "PASA" : "FALLA", severidad: pasa ? null : severidad || "Mayor" });
    const marca = pasa ? "OK  " : "FALLA";
    console.log(`${marca} ${id.padEnd(8)} ${descripcion}`);
    if (!pasa) console.log(`         esperado: ${esperado}\n         obtenido: ${obtenido}`);
};

const llamar = async (metodo, ruta, { token, body, esperarTexto } = {}) => {
    const cabeceras = { "Content-Type": "application/json" };
    if (token) cabeceras.Authorization = `Bearer ${token}`;
    const respuesta = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: body ? JSON.stringify(body) : undefined
    });
    if (respuesta.status === 429) {
        // authLimiter: 10 intentos fallidos por ventana de 2 minutos.
        console.log("         (429: esperando a que expire el limitador...)");
        await new Promise((r) => setTimeout(r, 121000));
        return llamar(metodo, ruta, { token, body, esperarTexto });
    }
    const texto = await respuesta.text();
    let datos = null;
    try { datos = JSON.parse(texto); } catch { datos = texto; }
    return { status: respuesta.status, datos, texto: esperarTexto ? texto : undefined, cookies: respuesta.headers.get("set-cookie") };
};

const sql = async (consulta, valores = []) => {
    const cliente = new Client({ connectionString: DB });
    await cliente.connect();
    try { return (await cliente.query(consulta, valores)).rows; }
    finally { await cliente.end(); }
};

const tokenDeCookie = (cookies) => {
    if (!cookies) return null;
    const m = /token=([^;,\s]+)/.exec(cookies);
    return m ? m[1] : null;
};

// ==================== 1. SEGURIDAD ====================
const bloque1Seguridad = async () => {
    console.log("\n=== 1. ACCESO Y SEGURIDAD ===");

    for (const [rol, cred] of Object.entries(CRED)) {
        const r = await llamar("POST", "/auth/login", { body: { identificador: cred.usuario, password: cred.password } });
        const token = tokenDeCookie(r.cookies);
        if (token) sesiones[rol] = token;
        registrar(`SEC-0${Object.keys(CRED).indexOf(rol) + 1}`, "Seguridad", `Login ${rol}`,
            "HTTP 200 + token en cookie", `HTTP ${r.status}${token ? " + token" : " SIN token"}`,
            r.status === 200 && Boolean(token), "Critico");
    }

    let r = await llamar("GET", "/auth/me");
    registrar("SEC-06", "Seguridad", "Ruta protegida sin token", "HTTP 401", `HTTP ${r.status}`, r.status === 401, "Critico");

    r = await llamar("GET", "/auth/me", { token: "token.falso.invalido" });
    registrar("SEC-07", "Seguridad", "Token manipulado", "HTTP 401", `HTTP ${r.status}`, r.status === 401, "Critico");

    r = await llamar("POST", "/auth/login", { body: { identificador: CRED.Administrador.usuario, password: "ClaveIncorrecta1" } });
    registrar("SEC-08", "Seguridad", "Login con contrasena incorrecta", "HTTP 401", `HTTP ${r.status}`, r.status === 401, "Critico");

    // Bloqueo tras 3 intentos: se usa el Vendedor para no dejar fuera al admin.
    for (let i = 0; i < 2; i += 1) {
        await llamar("POST", "/auth/login", { body: { identificador: CRED.Vendedor.usuario, password: "Incorrecta123" } });
    }
    r = await llamar("POST", "/auth/login", { body: { identificador: CRED.Vendedor.usuario, password: "Incorrecta123" } });
    const bloqueado = await sql("SELECT bloqueado, intentos_fallidos, bloqueado_hasta FROM usuarios WHERE usuario=$1", [CRED.Vendedor.usuario]);
    registrar("SEC-09", "Seguridad", "Bloqueo tras 3 intentos fallidos",
        "usuario bloqueado=true y HTTP 403",
        `HTTP ${r.status}, bloqueado=${bloqueado[0]?.bloqueado}, intentos=${bloqueado[0]?.intentos_fallidos}`,
        bloqueado[0]?.bloqueado === true, "Critico");

    r = await llamar("POST", "/auth/login", { body: { identificador: CRED.Vendedor.usuario, password: CRED.Vendedor.password } });
    registrar("SEC-10", "Seguridad", "Login correcto estando bloqueado", "HTTP 403 (rechazado)", `HTTP ${r.status}`, r.status === 403, "Critico");

    // Se desbloquea para no arrastrar el estado a los siguientes bloques.
    await sql("UPDATE usuarios SET bloqueado=FALSE, bloqueado_hasta=NULL, intentos_fallidos=0 WHERE usuario=$1", [CRED.Vendedor.usuario]);
    r = await llamar("POST", "/auth/login", { body: { identificador: CRED.Vendedor.usuario, password: CRED.Vendedor.password } });
    if (tokenDeCookie(r.cookies)) sesiones.Vendedor = tokenDeCookie(r.cookies);

    r = await llamar("POST", "/auth/forgot-password", { body: { identificador: CRED.Administrador.correo } });
    const tokensReset = await sql("SELECT COUNT(*)::int n FROM recuperacion_password WHERE usado=FALSE");
    registrar("SEC-11", "Seguridad", "Solicitar recuperacion de contrasena",
        "HTTP 200 y token generado en BD", `HTTP ${r.status}, tokens activos=${tokensReset[0].n}`,
        r.status === 200 && tokensReset[0].n > 0, "Mayor");

    r = await llamar("POST", "/auth/reset-password", { body: { token: "inexistente", password: "NuevaClave123" } });
    registrar("SEC-12", "Seguridad", "Restablecer con token invalido", "HTTP 400", `HTTP ${r.status}`, r.status === 400, "Mayor");

    // Logout debe revocar la sesion en servidor.
    const rLogin = await llamar("POST", "/auth/login", { body: { identificador: CRED.Cajero.usuario, password: CRED.Cajero.password } });
    const tokenTemporal = tokenDeCookie(rLogin.cookies);
    await llamar("POST", "/auth/logout", { token: tokenTemporal });
    r = await llamar("GET", "/auth/me", { token: tokenTemporal });
    registrar("SEC-13", "Seguridad", "Token invalidado tras logout", "HTTP 401", `HTTP ${r.status}`, r.status === 401, "Critico");
};

// ==================== 2. ROLES Y PERMISOS ====================
const bloque2Permisos = async () => {
    console.log("\n=== 2. MANTENIMIENTO Y PERMISOS ===");

    let r;
    const roles = await llamar("GET", "/usuarios/roles", { token: sesiones.Administrador });
    const idPaciente = (roles.datos || []).find((x) => x.nombre_rol === "Paciente")?.id_rol;
    registrar("MAN-03", "Mantenimiento", "Existe el rol Paciente en el catalogo",
        "rol Paciente presente", idPaciente ? `id_rol=${idPaciente}` : "NO existe", Boolean(idPaciente), "Critico");

    if (idPaciente) {
        r = await llamar("POST", "/auth/register", {
            token: sesiones.Administrador,
            body: { nombre: "Maria", apellido: "Cedeno", correo: "paciente.qa@example.com", usuario: "paciente.demo", password: "Paciente2026", cedula: String(Date.now()).slice(-10), telefono: "0981111111", id_rol: idPaciente }
        });
        registrar("MAN-04", "Mantenimiento", "Administrador crea usuario Paciente", "HTTP 200", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 200, "Critico");

        const login = await llamar("POST", "/auth/login", { body: { identificador: "paciente.demo", password: "Paciente2026" } });
        const token = tokenDeCookie(login.cookies);
        if (token) sesiones.Paciente = token;
        registrar("MAN-05", "Mantenimiento", "El nuevo Paciente puede iniciar sesion", "HTTP 200 + token", `HTTP ${login.status}`, login.status === 200 && Boolean(token), "Critico");
    }

    const matriz = [
        ["PER-01", "GET", "/usuarios", "Vendedor", 403, "Vendedor no lista usuarios"],
        ["PER-02", "GET", "/usuarios", "Administrador", 200, "Administrador lista usuarios"],
        ["PER-03", "GET", "/caja", "Vendedor", 403, "Vendedor no accede a caja"],
        ["PER-04", "GET", "/caja", "Cajero", 200, "Cajero accede a caja"],
        ["PER-05", "GET", "/historia", "Cajero", 403, "Cajero no lista historias clinicas"],
        ["PER-06", "GET", "/historia", "Optometra", 200, "Optometra lista historias clinicas"],
        ["PER-07", "GET", "/dashboard", "Paciente", 403, "Paciente no accede al dashboard interno"],
        ["PER-08", "GET", "/inventario", "Paciente", 403, "Paciente no accede al inventario admin"],
        ["PER-09", "GET", "/citas/mis-citas", "Optometra", 403, "Optometra no usa endpoint de paciente"],
        ["PER-10", "GET", "/compras/proveedores", "Optometra", 403, "Optometra no accede a compras"]
    ];

    for (const [id, metodo, ruta, rol, esperado, descripcion] of matriz) {
        if (!sesiones[rol]) { registrar(id, "Permisos", descripcion, `HTTP ${esperado}`, "sin sesion para ese rol", false, "Mayor"); continue; }
        const r = await llamar(metodo, ruta, { token: sesiones[rol] });
        registrar(id, "Permisos", descripcion, `HTTP ${esperado}`, `HTTP ${r.status}`, r.status === esperado, "Critico");
    }

    // Alta de usuario: solo Administrador
    r = await llamar("POST", "/auth/register", {
        token: sesiones.Vendedor,
        body: { nombre: "Intruso", correo: "intruso@test.demo", usuario: "intruso", password: "Password123", id_rol: 1 }
    });
    registrar("MAN-01", "Mantenimiento", "Vendedor intenta crear usuario", "HTTP 403", `HTTP ${r.status}`, r.status === 403, "Critico");

    r = await llamar("POST", "/auth/register", {
        token: sesiones.Administrador,
        body: { nombre: "Debil", correo: "debil@test.demo", usuario: "debil", password: "123", id_rol: 1 }
    });
    registrar("MAN-02", "Mantenimiento", "Contrasena debil rechazada", "HTTP 400", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 400, "Mayor");

    // Desactivar usuario y comprobar que no puede entrar
    const usuarios = await llamar("GET", "/usuarios", { token: sesiones.Administrador });
    const vendedor = (usuarios.datos || []).find((u) => u.usuario === CRED.Vendedor.usuario);
    if (vendedor) {
        r = await llamar("PATCH", `/usuarios/${vendedor.id_usuario}`, { token: sesiones.Administrador, body: { estado: false } });
        const login = await llamar("POST", "/auth/login", { body: { identificador: CRED.Vendedor.usuario, password: CRED.Vendedor.password } });
        registrar("MAN-06", "Mantenimiento", "Usuario desactivado no puede entrar", "HTTP 401", `PATCH ${r.status}, login ${login.status}`, login.status === 401, "Critico");
        await llamar("PATCH", `/usuarios/${vendedor.id_usuario}`, { token: sesiones.Administrador, body: { estado: true } });
    }

    const auditoria = await llamar("GET", "/usuarios/auditoria?limite=20", { token: sesiones.Administrador });
    const n = Array.isArray(auditoria.datos) ? auditoria.datos.length : 0;
    registrar("MAN-07", "Mantenimiento", "Auditoria registra eventos", "al menos 1 registro", `${n} registros`, n > 0, "Mayor");
};

// ==================== 3. CITAS ====================
const bloque3Citas = async () => {
    console.log("\n=== 3. CITAS ===");
    if (!sesiones.Paciente) { registrar("CIT-00", "Citas", "Sesion de paciente disponible", "token", "no hay", false, "Critico"); return; }

    const prof = await llamar("GET", "/citas/profesionales", { token: sesiones.Paciente });
    const optometra = (prof.datos || []).find((p) => /Optometra/i.test(p.nombre_rol || "")) || (prof.datos || [])[0];
    registrar("CIT-01", "Citas", "Paciente consulta profesionales", "HTTP 200 con lista", `HTTP ${prof.status}, ${(prof.datos || []).length} profesionales`, prof.status === 200 && (prof.datos || []).length > 0, "Mayor");
    if (!optometra) return;

    const futura = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const pasada = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

    let r = await llamar("POST", "/citas/mis-citas", { token: sesiones.Paciente, body: { id_usuario: optometra.id_usuario, fecha_cita: futura, hora_cita: "10:00", motivo: "Control de rutina" } });
    const idCita = r.datos?.id_cita;
    registrar("CIT-02", "Citas", "Reservar cita en fecha futura", "HTTP 201", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 201, "Critico");

    r = await llamar("POST", "/citas/mis-citas", { token: sesiones.Paciente, body: { id_usuario: optometra.id_usuario, fecha_cita: pasada, hora_cita: "10:00", motivo: "Cita en el pasado" } });
    registrar("CIT-03", "Citas", "Reservar cita en fecha pasada", "rechazo HTTP 4xx", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status >= 400 && r.status < 500, "Critico");

    r = await llamar("POST", "/citas/mis-citas", { token: sesiones.Paciente, body: { id_usuario: optometra.id_usuario, fecha_cita: futura, hora_cita: "10:00", motivo: "Choque de horario" } });
    registrar("CIT-04", "Citas", "Reservar en horario ya ocupado", "rechazo HTTP 4xx", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status >= 400 && r.status < 500, "Critico");

    const misCitas = await llamar("GET", "/citas/mis-citas", { token: sesiones.Paciente });
    registrar("CIT-05", "Citas", "Paciente ve sus citas", "lista con al menos 1", `HTTP ${misCitas.status}, ${(misCitas.datos || []).length} citas`, Array.isArray(misCitas.datos) && misCitas.datos.length > 0, "Critico");

    if (idCita) {
        const nueva = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
        r = await llamar("POST", `/citas/mis-citas/${idCita}/reagendar`, { token: sesiones.Paciente, body: { fecha_cita: nueva, hora_cita: "11:30" } });
        registrar("CIT-06", "Citas", "Reagendar cita a fecha futura", "HTTP 200", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 200, "Mayor");

        r = await llamar("POST", `/citas/mis-citas/${idCita}/reagendar`, { token: sesiones.Paciente, body: { fecha_cita: pasada, hora_cita: "09:00" } });
        registrar("CIT-07", "Citas", "Reagendar a fecha pasada", "rechazo HTTP 4xx", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status >= 400 && r.status < 500, "Critico");

        r = await llamar("POST", `/citas/mis-citas/${idCita}/cancelar`, { token: sesiones.Paciente, body: { motivo: "Prueba automatizada" } });
        const estado = await sql("SELECT estado FROM citas WHERE id_cita=$1", [idCita]);
        registrar("CIT-08", "Citas", "Cancelar cita propia", "estado=Cancelada", `HTTP ${r.status}, estado=${estado[0]?.estado}`, estado[0]?.estado === "Cancelada", "Critico");

        r = await llamar("POST", `/citas/mis-citas/${idCita}/cancelar`, { token: sesiones.Paciente, body: { motivo: "Repetida" } });
        registrar("CIT-09", "Citas", "Cancelar una cita ya cancelada", "rechazo HTTP 400", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 400, "Mayor");
    }

    const agenda = await llamar("GET", "/citas", { token: sesiones.Optometra });
    registrar("CIT-10", "Citas", "Optometra consulta la agenda", "HTTP 200", `HTTP ${agenda.status}`, agenda.status === 200, "Critico");
};

module.exports = { llamar, sql, registrar, resultados, sesiones, tokenDeCookie, CRED, bloque1Seguridad, bloque2Permisos, bloque3Citas };

if (require.main === module) {
    (async () => {
        await bloque1Seguridad();
        await bloque2Permisos();
        await bloque3Citas();
        require("fs").writeFileSync(__dirname + "/resultados-1.json", JSON.stringify(resultados, null, 2));
        require("fs").writeFileSync(__dirname + "/sesiones.json", JSON.stringify(sesiones, null, 2));
        const fallos = resultados.filter((x) => x.estado === "FALLA");
        console.log(`\nRESUMEN BLOQUES 1-3: ${resultados.length - fallos.length}/${resultados.length} PASAN, ${fallos.length} FALLAN`);
    })();
}
