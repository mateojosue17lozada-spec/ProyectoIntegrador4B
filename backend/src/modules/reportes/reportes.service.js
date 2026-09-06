const pool = require("../../config/database");

/**
 * Modulo de reportes (lista de cotejo, punto 5). Todas las consultas son de
 * SOLO LECTURA y aceptan filtros opcionales; cada filtro se agrega como
 * parametro para evitar inyeccion.
 */

// Construye una clausula WHERE acumulando condiciones y valores.
const filtro = () => {
    const cond = [];
    const val = [];
    return {
        add(sqlCond, value) {
            val.push(value);
            cond.push(sqlCond.replace("$$", `$${val.length}`));
        },
        where: () => (cond.length ? `WHERE ${cond.join(" AND ")}` : ""),
        values: () => val
    };
};

/** GET /reportes/citas?fecha_inicio&fecha_fin&medico&estado */
exports.citas = async (q = {}) => {
    const f = filtro();
    if (q.fecha_inicio) f.add("c.fecha_cita >= $$::date", q.fecha_inicio);
    if (q.fecha_fin) f.add("c.fecha_cita <= $$::date", q.fecha_fin);
    if (q.medico) f.add("c.id_usuario = $$", Number(q.medico));
    if (q.estado) f.add("c.estado = $$", q.estado);

    const r = await pool.query(
        `SELECT c.id_cita, c.fecha_cita, c.hora_cita, c.estado, c.motivo, c.consultorio,
                concat_ws(' ', pa.nombre, pa.apellido) AS paciente,
                concat_ws(' ', us.nombre, us.apellido) AS profesional
         FROM citas c
         LEFT JOIN pacientes pa ON pa.id_paciente = c.id_paciente
         LEFT JOIN usuarios us ON us.id_usuario = c.id_usuario
         ${f.where()}
         ORDER BY c.fecha_cita DESC, c.hora_cita DESC
         LIMIT 500`,
        f.values()
    );
    return { total: r.rowCount, filas: r.rows };
};

/** GET /reportes/ventas?fecha_inicio&fecha_fin&tipo_pago */
exports.ventas = async (q = {}) => {
    const f = filtro();
    f.add("f.estado = $$", "Emitida");
    if (q.fecha_inicio) f.add("f.creado_en::date >= $$::date", q.fecha_inicio);
    if (q.fecha_fin) f.add("f.creado_en::date <= $$::date", q.fecha_fin);
    if (q.tipo_pago) f.add("EXISTS (SELECT 1 FROM factura_pagos fp WHERE fp.id_factura=f.id_factura AND fp.forma_pago=$$)", q.tipo_pago);

    const filas = await pool.query(
        `SELECT f.id_factura, f.numero_factura, f.creado_en, f.subtotal, f.descuento,
                f.impuestos, f.total, f.estado,
                concat_ws(' ', pa.nombre, pa.apellido) AS paciente
         FROM facturas f
         LEFT JOIN pacientes pa ON pa.id_paciente = f.id_paciente
         ${f.where()}
         ORDER BY f.creado_en DESC
         LIMIT 500`,
        f.values()
    );

    // Resumen por forma de pago en el mismo rango.
    const g = filtro();
    g.add("f.estado = $$", "Emitida");
    if (q.fecha_inicio) g.add("f.creado_en::date >= $$::date", q.fecha_inicio);
    if (q.fecha_fin) g.add("f.creado_en::date <= $$::date", q.fecha_fin);
    const resumen = await pool.query(
        `SELECT fp.forma_pago, COUNT(DISTINCT f.id_factura)::int facturas, COALESCE(SUM(fp.monto),0) total
         FROM facturas f JOIN factura_pagos fp USING(id_factura)
         ${g.where()}
         GROUP BY fp.forma_pago ORDER BY total DESC`,
        g.values()
    );

    const totalGeneral = filas.rows.reduce((s, x) => s + Number(x.total), 0);
    return { total: filas.rowCount, total_facturado: Math.round(totalGeneral * 100) / 100, por_forma_pago: resumen.rows, filas: filas.rows };
};

/** GET /reportes/compras?fecha_inicio&fecha_fin&proveedor */
exports.compras = async (q = {}) => {
    const f = filtro();
    if (q.fecha_inicio) f.add("o.fecha_orden::date >= $$::date", q.fecha_inicio);
    if (q.fecha_fin) f.add("o.fecha_orden::date <= $$::date", q.fecha_fin);
    if (q.proveedor) f.add("o.id_proveedor = $$", Number(q.proveedor));

    const r = await pool.query(
        `SELECT o.id_orden_compra, o.fecha_orden, o.estado, o.total,
                pr.nombre AS proveedor
         FROM ordenes_compra o
         LEFT JOIN proveedores pr ON pr.id_proveedor = o.id_proveedor
         ${f.where()}
         ORDER BY o.fecha_orden DESC
         LIMIT 500`,
        f.values()
    );
    const total = r.rows.reduce((s, x) => s + Number(x.total || 0), 0);
    return { total: r.rowCount, total_comprado: Math.round(total * 100) / 100, filas: r.rows };
};

/** GET /reportes/inventario?categoria&stock_minimo */
exports.inventario = async (q = {}) => {
    // Se arma manualmente porque "stock <= stock_minimo" es una condicion sin
    // parametro y el helper generico siempre espera un valor.
    const cond = [];
    const val = [];
    val.push(true); cond.push(`p.activo = $${val.length}`);
    if (q.categoria) { val.push(q.categoria); cond.push(`c.nombre = $${val.length}`); }
    if (q.stock_minimo === "true" || q.stock_minimo === true) cond.push("p.stock <= p.stock_minimo");

    const r = await pool.query(
        `SELECT p.id_producto, p.sku, p.nombre, c.nombre AS categoria,
                p.stock, p.stock_minimo, (p.stock <= p.stock_minimo) AS stock_bajo,
                p.costo, p.precio
         FROM productos p
         LEFT JOIN categorias_producto c ON c.id_categoria = p.id_categoria
         WHERE ${cond.join(" AND ")}
         ORDER BY stock_bajo DESC, p.nombre
         LIMIT 500`,
        val
    );
    const bajos = r.rows.filter((x) => x.stock_bajo).length;
    return { total: r.rowCount, en_alerta: bajos, filas: r.rows };
};

/** GET /reportes/cierre-caja?fecha&cajero */
exports.cierreCaja = async (q = {}) => {
    const f = filtro();
    f.add("ct.estado = $$", "Cerrada");
    if (q.fecha) f.add("ct.fecha = $$::date", q.fecha);
    if (q.cajero) f.add("ct.id_cajero = $$", Number(q.cajero));

    const r = await pool.query(
        `SELECT ct.id_caja_turno, ct.fecha, ct.abierto_en, ct.cerrado_en,
                ct.monto_apertura, ct.monto_cierre, ct.efectivo_esperado, ct.diferencia,
                ct.total_efectivo, ct.total_tarjeta, ct.total_transferencia, ct.total_credito,
                ct.retiro_banco, ct.responsable, ct.observaciones,
                (COALESCE(ct.monto_cierre,0) - COALESCE(ct.retiro_banco,0)) AS fondo_vueltos,
                (COALESCE(ct.total_efectivo,0)+COALESCE(ct.total_tarjeta,0)+COALESCE(ct.total_transferencia,0)+COALESCE(ct.total_credito,0)) AS total_general,
                concat_ws(' ', u.nombre, u.apellido) AS cajero
         FROM caja_turnos ct
         LEFT JOIN usuarios u ON u.id_usuario = ct.id_cajero
         ${f.where()}
         ORDER BY ct.cerrado_en DESC NULLS LAST
         LIMIT 500`,
        f.values()
    );
    return { total: r.rowCount, filas: r.rows };
};

/** GET /reportes/opciones-filtros */
exports.opcionesFiltros = async () => {
    const medicos = await pool.query(
        `SELECT u.id_usuario, concat_ws(' ', u.nombre, u.apellido) AS nombre
         FROM usuarios u JOIN roles r USING(id_rol)
         WHERE r.nombre_rol IN ('Optometra', 'Administrador') AND u.estado=TRUE
         ORDER BY u.nombre`
    );
    const cajeros = await pool.query(
        `SELECT u.id_usuario, concat_ws(' ', u.nombre, u.apellido) AS nombre
         FROM usuarios u JOIN roles r USING(id_rol)
         WHERE r.nombre_rol IN ('Cajero', 'Administrador') AND u.estado=TRUE
         ORDER BY u.nombre`
    );
    const proveedores = await pool.query(
        `SELECT id_proveedor, nombre FROM proveedores WHERE activo=TRUE ORDER BY nombre`
    );
    const categorias = await pool.query(
        `SELECT id_categoria, nombre FROM categorias_producto WHERE activo=TRUE ORDER BY nombre`
    );

    return {
        medicos: medicos.rows,
        cajeros: cajeros.rows,
        proveedores: proveedores.rows,
        categorias: categorias.rows
    };
};

