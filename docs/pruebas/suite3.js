/** Bloques 5-9 y 12: caja, facturacion, compras, inventario, cartera y flujos integrados. */
const { Client } = require("pg");
const fs = require("fs");

const BASE = "http://localhost:3010/api";
const DB = "postgresql://postgres:test123@localhost:55432/optica_test";
const CRED = require("./credenciales.json");
const RUTA_CAJA = "C:/Users/user/Desktop/ProyectoIntegrador4B/backend/src/modules/caja/caja.service.js";

const resultados = [];
const sesiones = {};

const registrar = (id, modulo, descripcion, esperado, obtenido, pasa, severidad) => {
    resultados.push({ id, modulo, descripcion, esperado, obtenido, estado: pasa ? "PASA" : "FALLA", severidad: pasa ? null : severidad || "Mayor" });
    console.log(`${pasa ? "OK  " : "FALLA"} ${id.padEnd(8)} ${descripcion}`);
    if (!pasa) console.log(`         esperado: ${esperado}\n         obtenido: ${obtenido}`);
};

const llamar = async (metodo, ruta, { token, body } = {}) => {
    const h = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${ruta}`, { method: metodo, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 121000)); return llamar(metodo, ruta, { token, body }); }
    const t = await res.text();
    let d; try { d = JSON.parse(t); } catch { d = t; }
    return { status: res.status, datos: d, cookies: res.headers.get("set-cookie") };
};

const sql = async (q, v = []) => {
    const c = new Client({ connectionString: DB });
    await c.connect();
    try { return (await c.query(q, v)).rows; } finally { await c.end(); }
};

const entrar = async (rol, usuario, password) => {
    const r = await llamar("POST", "/auth/login", { body: { identificador: usuario, password } });
    const m = /token=([^;,\s]+)/.exec(r.cookies || "");
    if (m) sesiones[rol] = m[1];
};

// ==================== 9. CAJA (Diana req. 1) ====================
const bloqueCaja = async () => {
    console.log("\n=== 9. CAJA - ARQUEO DE CIERRE (Diana req. 1) ===");

    // Los turnos previos se mueven a ayer: el servicio impide reabrir caja el
    // mismo dia en que ya se cerro una.
    await sql("UPDATE caja_turnos SET fecha = CURRENT_DATE - 1, abierto_en = abierto_en - INTERVAL '1 day', estado='Cerrada', monto_cierre=COALESCE(monto_cierre,0), cerrado_en=COALESCE(cerrado_en, NOW())");

    let r = await llamar("POST", "/caja/abrir", { token: sesiones.Cajero, body: { monto_apertura: 100 } });
    const idTurno = r.datos?.id_caja_turno;
    registrar("CAJ-01", "Caja", "Abrir caja con monto de apertura", "HTTP 201 y turno abierto",
        `HTTP ${r.status} ${r.datos?.mensaje || ""}, id=${idTurno}`, r.status === 201 && Boolean(idTurno), "Critico");

    r = await llamar("POST", "/caja/abrir", { token: sesiones.Cajero, body: { monto_apertura: 50 } });
    registrar("CAJ-02", "Caja", "Abrir una segunda caja teniendo una abierta", "rechazo HTTP 4xx",
        `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status >= 400, "Mayor");

    r = await llamar("POST", "/caja/abrir", { token: sesiones.Cajero, body: { monto_apertura: -50 } });
    registrar("CAJ-03", "Caja", "Abrir caja con monto negativo", "rechazo HTTP 400", `HTTP ${r.status}`, r.status >= 400, "Mayor");

    // Ventas con distintas formas de pago dentro del mismo turno.
    const productos = await sql("SELECT id_producto, nombre, precio FROM productos WHERE stock > 3 ORDER BY id_producto LIMIT 3");
    const pacienteId = (await sql("SELECT id_paciente FROM pacientes ORDER BY id_paciente LIMIT 1"))[0].id_paciente;
    const emitidas = [];
    for (const [i, forma] of ["Efectivo", "Tarjeta", "Transferencia"].entries()) {
        const p = productos[i] || productos[0];
        const f = await llamar("POST", "/facturacion", {
            token: sesiones.Cajero,
            body: {
                id_paciente: pacienteId,
                detalles: [{ id_producto: p.id_producto, descripcion: p.nombre, cantidad: 1, precio_unitario: Number(p.precio) }],
                pagos: [{ forma_pago: forma, monto: Number(p.precio) }]
            }
        });
        emitidas.push({ forma, status: f.status, mensaje: f.datos?.mensaje });
    }
    const ok = emitidas.filter((f) => f.status === 201 || f.status === 200);
    registrar("CAJ-04", "Caja", "Facturar en efectivo, tarjeta y transferencia", "3 facturas emitidas",
        emitidas.map((f) => `${f.forma}:${f.status}${f.mensaje ? " " + f.mensaje : ""}`).join(" | "), ok.length === 3, "Critico");

    r = await llamar("POST", "/caja/cerrar", {
        token: sesiones.Cajero,
        body: {
            monto_cierre: 155,
            observaciones: "Arqueo de prueba automatizada",
            // Campos del requerimiento de Diana, enviados para ver si se reconocen.
            efectivo_para_vueltos: 50,
            efectivo_retirado_banco: 105,
            total_tarjeta: 65,
            total_transferencia: 24
        }
    });
    const turno = (await sql("SELECT * FROM caja_turnos WHERE id_caja_turno=$1", [idTurno]))[0] || {};
    registrar("CAJ-05", "Caja", "Cerrar caja (arqueo)", "HTTP 200 y estado=Cerrada",
        `HTTP ${r.status}, estado=${turno.estado}, esperado=${turno.efectivo_esperado}, contado=${turno.monto_cierre}, diferencia=${turno.diferencia}`,
        r.status === 200 && turno.estado === "Cerrada", "Critico");

    const cols = (await sql("SELECT column_name FROM information_schema.columns WHERE table_name='caja_turnos'")).map((c) => c.column_name);
    const requisitos = [
        ["CAJ-06", "Total por tipo de pago (tarjeta, transferencia, credito, mixto)", /tarjeta|transferencia|credito|mixto/],
        ["CAJ-07", "Efectivo que se queda en caja para vueltos", /vuelto|fondo|base_caja/],
        ["CAJ-08", "Efectivo retirado y enviado al banco", /retiro|retirado|banco|deposito/],
        ["CAJ-09", "Observaciones del cajero", /observacion/],
        ["CAJ-10", "Responsable del cierre", /cajero|responsable/]
    ];
    for (const [id, descripcion, patron] of requisitos) {
        const halladas = cols.filter((c) => patron.test(c));
        registrar(id, "Caja (Diana)", descripcion, "columna presente en caja_turnos",
            halladas.length ? `presente: ${halladas.join(", ")}` : `NO EXISTE`, halladas.length > 0, "Critico");
    }

    const desglose = await sql(
        `SELECT fp.forma_pago, SUM(fp.monto)::numeric total FROM factura_pagos fp
         JOIN facturas f USING(id_factura) WHERE f.id_caja_turno=$1 GROUP BY fp.forma_pago ORDER BY 1`, [idTurno]);
    registrar("CAJ-11", "Caja (Diana)", "El arqueo guarda el desglose por forma de pago",
        "un total por cada forma usada",
        `hubo ${desglose.length} formas en el turno (${desglose.map((d) => d.forma_pago + "=" + d.total).join(", ")}), pero el cierre solo persiste ventas_efectivo=${turno.ventas_efectivo}`,
        desglose.length > 1 && cols.some((c) => /tarjeta/.test(c)), "Critico");

    const codigoCaja = fs.readFileSync(RUTA_CAJA, "utf8");
    const porTurno = /abonos_cxc[\s\S]{0,220}id_caja_turno/.test(codigoCaja);
    registrar("CAJ-12", "Caja", "El efectivo esperado se calcula por turno, no por dia",
        "abonos y devoluciones filtrados por id_caja_turno",
        porTurno ? "filtrado por turno" : "filtrados por CURRENT_DATE: con dos cajeros el mismo dia cada arqueo suma el efectivo del otro",
        porTurno, "Critico");

    const historial = await llamar("GET", "/caja/historial", { token: sesiones.Cajero });
    registrar("CAJ-13", "Caja", "Historial de cierres accesible", "HTTP 200 con turnos",
        `HTTP ${historial.status}, ${(historial.datos || []).length} turnos`,
        historial.status === 200 && (historial.datos || []).length > 0, "Mayor");

    return idTurno;
};

// ==================== 5. FACTURACION ====================
const bloqueFacturacion = async () => {
    console.log("\n=== 5. VENTAS Y FACTURACION ===");
    await sql("UPDATE caja_turnos SET fecha=CURRENT_DATE-1, abierto_en=abierto_en - INTERVAL '1 day', estado='Cerrada', monto_cierre=COALESCE(monto_cierre,0), cerrado_en=COALESCE(cerrado_en,NOW())");
    const abrir = await llamar("POST", "/caja/abrir", { token: sesiones.Cajero, body: { monto_apertura: 200 } });
    const idTurno = abrir.datos?.id_caja_turno;

    const pacienteId = (await sql("SELECT id_paciente FROM pacientes ORDER BY id_paciente LIMIT 1"))[0].id_paciente;
    const p = (await sql("SELECT id_producto, nombre, precio, stock FROM productos WHERE stock > 5 ORDER BY id_producto LIMIT 1"))[0];

    // Pago parcial: debe generar cuenta por cobrar.
    let r = await llamar("POST", "/facturacion", {
        token: sesiones.Cajero,
        body: {
            id_paciente: pacienteId,
            detalles: [{ id_producto: p.id_producto, descripcion: p.nombre, cantidad: 2, precio_unitario: Number(p.precio) }],
            pagos: [{ forma_pago: "Efectivo", monto: Number(p.precio) }]
        }
    });
    const idFactura = r.datos?.id_factura;
    const cxc = await sql("SELECT saldo FROM cuentas_por_cobrar WHERE id_factura=$1", [idFactura]);
    registrar("FAC-01", "Facturacion", "Factura con pago parcial genera cuenta por cobrar",
        "HTTP 201 y CxC con saldo",
        `HTTP ${r.status}, cxc=${cxc.length ? cxc[0].saldo : "ninguna"}`,
        r.status === 201 && cxc.length === 1 && Number(cxc[0].saldo) > 0, "Critico");

    const stockDespues = (await sql("SELECT stock FROM productos WHERE id_producto=$1", [p.id_producto]))[0];
    registrar("FAC-02", "Facturacion", "La venta descuenta stock",
        `stock ${p.stock} -> ${p.stock - 2}`, `stock=${stockDespues.stock}`,
        stockDespues.stock === p.stock - 2, "Critico");

    // Stock insuficiente
    r = await llamar("POST", "/facturacion", {
        token: sesiones.Cajero,
        body: { id_paciente: pacienteId, detalles: [{ id_producto: p.id_producto, descripcion: p.nombre, cantidad: 99999, precio_unitario: 1 }], pagos: [{ forma_pago: "Efectivo", monto: 1 }] }
    });
    registrar("FAC-03", "Facturacion", "Venta con stock insuficiente", "rechazo HTTP 409",
        `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 409, "Critico");

    // Descuento sin ser Administrador
    r = await llamar("POST", "/facturacion", {
        token: sesiones.Cajero,
        body: { id_paciente: pacienteId, descuento: 10, detalles: [{ id_producto: p.id_producto, descripcion: p.nombre, cantidad: 1, precio_unitario: Number(p.precio) }], pagos: [{ forma_pago: "Efectivo", monto: 1 }] }
    });
    registrar("FAC-04", "Facturacion", "Descuento aplicado por Cajero", "rechazo HTTP 403",
        `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 403, "Critico");

    // Factura vacia y forma de pago inexistente
    r = await llamar("POST", "/facturacion", { token: sesiones.Cajero, body: { detalles: [], pagos: [] } });
    registrar("FAC-05", "Facturacion", "Factura sin detalles", "rechazo HTTP 400", `HTTP ${r.status}`, r.status === 400, "Mayor");

    r = await llamar("POST", "/facturacion", {
        token: sesiones.Cajero,
        body: { id_paciente: pacienteId, detalles: [{ id_producto: p.id_producto, descripcion: p.nombre, cantidad: 1, precio_unitario: 10 }], pagos: [{ forma_pago: "Bitcoin", monto: 10 }] }
    });
    registrar("FAC-06", "Facturacion", "Forma de pago no permitida", "rechazo HTTP 400", `HTTP ${r.status}`, r.status === 400, "Mayor");

    // Devolucion -> nota de credito + stock
    if (idFactura) {
        const stockAntes = (await sql("SELECT stock FROM productos WHERE id_producto=$1", [p.id_producto]))[0].stock;
        r = await llamar("POST", `/facturacion/${idFactura}/devoluciones`, {
            token: sesiones.Administrador,
            body: { motivo: "Producto en mal estado", detalles: [{ id_producto: p.id_producto, cantidad: 1, monto: Number(p.precio) }], monto: Number(p.precio), forma_pago: "Efectivo" }
        });
        const nota = await sql("SELECT COUNT(*)::int n FROM notas_credito WHERE id_factura=$1", [idFactura]);
        const stockTrasDev = (await sql("SELECT stock FROM productos WHERE id_producto=$1", [p.id_producto]))[0].stock;
        registrar("FAC-07", "Facturacion", "Devolucion genera nota de credito",
            "HTTP 2xx y nota registrada", `HTTP ${r.status} ${r.datos?.mensaje || ""}, notas=${nota[0].n}`,
            r.status < 400 && nota[0].n > 0, "Critico");
        registrar("FAC-08", "Facturacion", "La devolucion repone stock",
            `stock ${stockAntes} -> ${stockAntes + 1}`, `stock=${stockTrasDev}`,
            stockTrasDev > stockAntes, "Mayor");
    }

    return { idTurno, idFactura };
};

// ==================== 7-8. INVENTARIO Y CARTERA ====================
const bloqueInventarioCartera = async (idFactura) => {
    console.log("\n=== 7-8. INVENTARIO Y CARTERA ===");

    const cat = await llamar("GET", "/inventario/categorias", { token: sesiones.Administrador });
    const idCategoria = (cat.datos || [])[0]?.id_categoria;

    let r = await llamar("POST", "/inventario", {
        token: sesiones.Administrador,
        body: { id_categoria: idCategoria, nombre: "Mica prueba QA " + Date.now(), sku: "QA-MICA-" + Date.now(), descripcion: "Producto de prueba", material: "Policarbonato", esfera: -2.0, cilindro: -0.5, eje: 90, stock: 4, stock_minimo: 5, costo: 10, precio: 25, tipo_lente: "Monofocal", filtro: "UV" }
    });
    const idProducto = r.datos?.id_producto;
    registrar("INV-01", "Inventario", "Crear producto con atributos opticos", "HTTP 201",
        `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 201, "Critico");

    const bajo = await sql("SELECT stock <= stock_minimo alerta FROM productos WHERE id_producto=$1", [idProducto]);
    registrar("INV-02", "Inventario", "Producto bajo el minimo se detecta", "stock <= stock_minimo",
        `alerta=${bajo[0]?.alerta}`, bajo[0]?.alerta === true, "Mayor");

    const dash = await llamar("GET", "/dashboard", { token: sesiones.Administrador });
    registrar("INV-03", "Inventario", "El dashboard cuenta el stock bajo", "stock_bajo >= 1",
        `stock_bajo=${dash.datos?.stock_bajo}`, Number(dash.datos?.stock_bajo) >= 1, "Mayor");

    r = await llamar("POST", "/inventario/ajustes", { token: sesiones.Administrador, body: { id_producto: idProducto, tipo: "Merma", cantidad: -2, motivo: "Rotura en prueba QA" } });
    const tras = (await sql("SELECT stock FROM productos WHERE id_producto=$1", [idProducto]))[0];
    registrar("INV-04", "Inventario", "Ajuste por merma descuenta stock", "HTTP 201 y stock 4 -> 2",
        `HTTP ${r.status}, stock=${tras?.stock}`, r.status === 201 && tras?.stock === 2, "Critico");

    r = await llamar("POST", "/inventario/ajustes", { token: sesiones.Administrador, body: { id_producto: idProducto, tipo: "Merma", cantidad: -9999, motivo: "Intento de stock negativo" } });
    const final = (await sql("SELECT stock FROM productos WHERE id_producto=$1", [idProducto]))[0];
    registrar("INV-05", "Inventario", "Ajuste que dejaria stock negativo", "rechazo y stock intacto",
        `HTTP ${r.status}, stock=${final?.stock}`, r.status >= 400 && final?.stock >= 0, "Critico");

    // Cartera
    const cobrar = await llamar("GET", "/cartera/cobrar", { token: sesiones.Cajero });
    const lista = Array.isArray(cobrar.datos) ? cobrar.datos : cobrar.datos?.rows || [];
    registrar("CAR-01", "Cartera", "Listar cuentas por cobrar", "HTTP 200 con al menos 1",
        `HTTP ${cobrar.status}, ${lista.length} cuentas`, cobrar.status === 200 && lista.length > 0, "Mayor");

    const cuenta = (await sql("SELECT id_cxc, saldo FROM cuentas_por_cobrar WHERE saldo > 0 ORDER BY id_cxc DESC LIMIT 1"))[0];
    if (cuenta) {
        const abono = 5;
        r = await llamar("POST", `/cartera/cobrar/${cuenta.id_cxc}/abonos`, { token: sesiones.Cajero, body: { monto: abono, forma_pago: "Efectivo" } });
        const despues = (await sql("SELECT saldo FROM cuentas_por_cobrar WHERE id_cxc=$1", [cuenta.id_cxc]))[0];
        registrar("CAR-02", "Cartera", "Abonar a una cuenta por cobrar",
            `saldo ${cuenta.saldo} -> ${Number(cuenta.saldo) - abono}`,
            `HTTP ${r.status}, saldo=${despues?.saldo}`,
            r.status < 400 && Number(despues?.saldo) === Number(cuenta.saldo) - abono, "Critico");

        r = await llamar("POST", `/cartera/cobrar/${cuenta.id_cxc}/abonos`, { token: sesiones.Cajero, body: { monto: 999999, forma_pago: "Efectivo" } });
        registrar("CAR-03", "Cartera", "Abono superior al saldo", "rechazo HTTP 4xx",
            `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status >= 400, "Mayor");
    }

    // Bloqueo por vencidos
    await sql("UPDATE cuentas_por_cobrar SET fecha_vencimiento = CURRENT_DATE - 10 WHERE saldo > 0");
    const pacienteConDeuda = (await sql("SELECT id_paciente FROM cuentas_por_cobrar WHERE saldo>0 LIMIT 1"))[0];
    const prod = (await sql("SELECT id_producto, nombre, precio FROM productos WHERE stock > 2 LIMIT 1"))[0];
    r = await llamar("POST", "/facturacion", {
        token: sesiones.Cajero,
        body: { id_paciente: pacienteConDeuda?.id_paciente, detalles: [{ id_producto: prod.id_producto, descripcion: prod.nombre, cantidad: 1, precio_unitario: Number(prod.precio) }], pagos: [{ forma_pago: "Efectivo", monto: 1 }] }
    });
    registrar("CAR-04", "Cartera", "Credito bloqueado por saldos vencidos", "rechazo HTTP 409",
        `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 409, "Critico");
};

// ==================== 6. COMPRAS ====================
const bloqueCompras = async () => {
    console.log("\n=== 6. COMPRAS ===");

    let r = await llamar("POST", "/compras/proveedores", {
        token: sesiones.Administrador,
        body: { nombre: "Proveedor QA " + Date.now(), ruc: String(Date.now()).slice(-11) + "001", telefono: "042000000", correo: "qa@proveedor.demo", direccion: "Guayaquil", condiciones_credito: "Credito 30 dias", dias_credito: 30 }
    });
    const idProveedor = r.datos?.id_proveedor;
    registrar("COM-01", "Compras", "Registrar proveedor", "HTTP 201", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 201, "Mayor");

    const p = (await sql("SELECT id_producto, nombre, stock, costo FROM productos ORDER BY id_producto LIMIT 1"))[0];
    r = await llamar("POST", "/compras", {
        token: sesiones.Administrador,
        body: { id_proveedor: idProveedor, detalles: [{ id_producto: p.id_producto, descripcion: p.nombre, cantidad: 10, costo_unitario: 20 }] }
    });
    const idOrden = r.datos?.id_orden_compra;
    registrar("COM-02", "Compras", "Crear orden de compra", "HTTP 201", `HTTP ${r.status} ${r.datos?.mensaje || ""}`, r.status === 201, "Critico");

    if (idOrden) {
        r = await llamar("POST", `/compras/${idOrden}/recibir`, {
            token: sesiones.Administrador,
            body: { factura_proveedor: "FAC-QA-" + Date.now(), detalles: [{ id_producto: p.id_producto, cantidad: 10, costo_unitario: 20 }] }
        });
        const tras = (await sql("SELECT stock, costo FROM productos WHERE id_producto=$1", [p.id_producto]))[0];
        registrar("COM-03", "Compras", "Recibir orden actualiza stock",
            `stock ${p.stock} -> ${p.stock + 10}`, `HTTP ${r.status} ${r.datos?.mensaje || ""}, stock=${tras.stock}, costo=${tras.costo}`,
            r.status < 400 && tras.stock === p.stock + 10, "Critico");

        const cxp = await sql("SELECT id_cxp, saldo FROM cuentas_por_pagar WHERE id_orden_compra=$1", [idOrden]);
        registrar("COM-04", "Compras", "La recepcion genera cuenta por pagar", "1 CxP con saldo",
            cxp.length ? `saldo=${cxp[0].saldo}` : "no se genero CxP", cxp.length > 0, "Critico");

        if (cxp.length) {
            r = await llamar("POST", `/cartera/pagar/${cxp[0].id_cxp}/abonos`, { token: sesiones.Administrador, body: { monto: 50, forma_pago: "Transferencia" } });
            const despues = (await sql("SELECT saldo FROM cuentas_por_pagar WHERE id_cxp=$1", [cxp[0].id_cxp]))[0];
            registrar("COM-05", "Compras", "Abonar a cuenta por pagar",
                `saldo ${cxp[0].saldo} -> ${Number(cxp[0].saldo) - 50}`, `HTTP ${r.status}, saldo=${despues.saldo}`,
                r.status < 400 && Number(despues.saldo) === Number(cxp[0].saldo) - 50, "Critico");
        }
    }
};

// ==================== 12. FLUJO INTEGRADO: PEDIDO WEB ====================
const bloqueFlujoPedido = async () => {
    console.log("\n=== 12. FLUJO INTEGRADO: PEDIDO WEB -> FACTURA ===");

    const productos = await llamar("GET", "/inventario/catalogo", { token: sesiones.Paciente });
    const lista = Array.isArray(productos.datos) ? productos.datos : [];
    registrar("FLU-01", "Flujo", "Paciente consulta el catalogo", "HTTP 200 con productos",
        `HTTP ${productos.status}, ${lista.length} productos`, productos.status === 200 && lista.length > 0, "Critico");

    const armazon = lista.find((x) => /armaz|montura/i.test(`${x.categoria} ${x.nombre}`)) || lista[0];
    if (!armazon) return;

    const detalle = await llamar("GET", `/inventario/catalogo/${armazon.id_producto}`, { token: sesiones.Paciente });
    registrar("FLU-02", "Flujo", "Paciente abre el detalle del producto", "HTTP 200",
        `HTTP ${detalle.status}`, detalle.status === 200, "Mayor");

    // Pedido con imagen del probador virtual (requisito de innovacion).
    const imagen = "data:image/jpeg;base64," + Buffer.from("prueba-virtual-simulada").toString("base64");
    let r = await llamar("POST", "/inventario/pedido", {
        token: sesiones.Paciente,
        body: { detalles: [{ id_producto: armazon.id_producto, cantidad: 1, prueba_virtual: imagen }] }
    });
    const idPedido = r.datos?.id_pedido;
    registrar("FLU-03", "Flujo", "Paciente genera pedido web con prueba virtual adjunta",
        "HTTP 201", `HTTP ${r.status} ${r.datos?.mensaje || ""}, pedido=${idPedido}`, r.status === 201, "Critico");

    const guardada = await sql("SELECT prueba_virtual_data IS NOT NULL tiene FROM pedido_detalle WHERE id_pedido=$1", [idPedido]);
    registrar("FLU-04", "Innovacion", "La imagen del probador se guarda en el pedido",
        "prueba_virtual_data no nula", `tiene=${guardada[0]?.tiene}`, guardada[0]?.tiene === true, "Mayor");

    const verPrueba = await llamar("GET", `/inventario/pedido/${idPedido}/prueba/${armazon.id_producto}`, { token: sesiones.Cajero });
    registrar("FLU-05", "Innovacion", "El cajero puede ver la prueba virtual del pedido",
        "HTTP 200 con la imagen", `HTTP ${verPrueba.status}`, verPrueba.status === 200, "Mayor");

    const pedidos = await llamar("GET", "/inventario/pedidos", { token: sesiones.Cajero });
    const encontrado = (pedidos.datos || []).some((x) => x.id_pedido === idPedido);
    registrar("FLU-06", "Flujo", "El cajero ve el pedido pendiente", "pedido en la lista",
        `HTTP ${pedidos.status}, encontrado=${encontrado}`, pedidos.status === 200 && encontrado, "Critico");

    const stockAntes = (await sql("SELECT stock FROM productos WHERE id_producto=$1", [armazon.id_producto]))[0].stock;
    r = await llamar("POST", `/inventario/pedido/${idPedido}/convertir`, { token: sesiones.Cajero });
    const stockDespues = (await sql("SELECT stock FROM productos WHERE id_producto=$1", [armazon.id_producto]))[0].stock;
    const estadoPedido = (await sql("SELECT estado FROM pedidos_pendientes WHERE id_pedido=$1", [idPedido]))[0];
    registrar("FLU-07", "Flujo", "El cajero convierte el pedido en factura",
        "HTTP 2xx, pedido COMPLETADO y stock descontado",
        `HTTP ${r.status} ${r.datos?.mensaje || ""}, estado=${estadoPedido?.estado}, stock ${stockAntes} -> ${stockDespues}`,
        r.status < 400 && stockDespues === stockAntes - 1, "Critico");
};

// ==================== 10. REPORTES ====================
const bloqueReportes = async () => {
    console.log("\n=== 10. REPORTES ===");
    const rutas = [
        ["REP-01", "/reportes", "Modulo de reportes"],
        ["REP-02", "/reportes/citas", "Reporte de citas"],
        ["REP-03", "/reportes/ventas", "Reporte de ventas"],
        ["REP-04", "/reportes/inventario", "Reporte de inventario"],
        ["REP-05", "/reportes/caja", "Reporte de cierre de caja"]
    ];
    for (const [id, ruta, descripcion] of rutas) {
        const r = await llamar("GET", ruta, { token: sesiones.Administrador });
        registrar(id, "Reportes", descripcion, "HTTP 200",
            r.status === 404 ? "HTTP 404: NO IMPLEMENTADO" : `HTTP ${r.status}`, r.status === 200, "Mayor");
    }
    // Sustitutos existentes
    const resumen = await llamar("GET", "/facturacion/resumen-dia", { token: sesiones.Cajero });
    registrar("REP-06", "Reportes", "Sustituto: resumen del dia de facturacion", "HTTP 200",
        `HTTP ${resumen.status}`, resumen.status === 200, "Menor");
    const historial = await llamar("GET", "/caja/historial", { token: sesiones.Administrador });
    registrar("REP-07", "Reportes", "Sustituto: historial de cierres de caja", "HTTP 200",
        `HTTP ${historial.status}`, historial.status === 200, "Menor");
};

if (require.main === module) {
    (async () => {
        for (const [rol, c] of Object.entries(CRED)) await entrar(rol, c.usuario, c.password);
        await entrar("Paciente", "paciente.demo", "Paciente2026");

        await bloqueCaja();
        const { idFactura } = await bloqueFacturacion();
        await bloqueInventarioCartera(idFactura);
        await bloqueCompras();
        await bloqueFlujoPedido();
        await bloqueReportes();

        fs.writeFileSync(__dirname + "/resultados-3.json", JSON.stringify(resultados, null, 2));
        const fallos = resultados.filter((x) => x.estado === "FALLA");
        console.log(`\nRESUMEN: ${resultados.length - fallos.length}/${resultados.length} PASAN, ${fallos.length} FALLAN`);
    })();
}
