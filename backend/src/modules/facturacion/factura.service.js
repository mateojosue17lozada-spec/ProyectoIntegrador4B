const pool = require("../../config/database");
const audit = require("../../utils/audit");

const formas = ["Efectivo", "Tarjeta", "Transferencia", "Credito", "Mixto"];
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// Listar facturas con pagado y saldo
exports.listar = async () => (await pool.query(
    `SELECT 
        f.*,
        p.nombre paciente_nombre,
        p.apellido paciente_apellido,
        COALESCE((SELECT SUM(monto) FROM factura_pagos WHERE id_factura = f.id_factura), 0) AS pagado,
        f.total - COALESCE((SELECT SUM(monto) FROM factura_pagos WHERE id_factura = f.id_factura), 0) AS saldo
     FROM facturas f
     LEFT JOIN pacientes p ON p.id_paciente = f.id_paciente
     ORDER BY f.creado_en DESC`
)).rows;

exports.resumenDia = async () => {
    // totalFacturas is the sum of f.total for facturas today where estado is 'Emitida'
    const queryFacturas = `
      SELECT 
        COUNT(id_factura) as "facturasEmitidas",
        COALESCE(SUM(total), 0) as "totalFacturas"
      FROM facturas
      WHERE creado_en::date = CURRENT_DATE AND estado = 'Emitida'
    `;
    const resFacturas = await pool.query(queryFacturas);

    const queryPagos = `
      SELECT 
        fp.forma_pago,
        COALESCE(SUM(fp.monto), 0) as total
      FROM factura_pagos fp
      JOIN facturas f ON f.id_factura = fp.id_factura
      WHERE f.creado_en::date = CURRENT_DATE AND f.estado = 'Emitida'
      GROUP BY fp.forma_pago
    `;
    const resPagos = await pool.query(queryPagos);
    
    let totalEfectivo = 0, totalTarjeta = 0, totalTransferencia = 0, totalCredito = 0;
    resPagos.rows.forEach(r => {
      if (r.forma_pago === 'Efectivo') totalEfectivo = Number(r.total);
      else if (r.forma_pago === 'Tarjeta') totalTarjeta = Number(r.total);
      else if (r.forma_pago === 'Transferencia') totalTransferencia = Number(r.total);
    });

    // Saldo is totalCredito
    const creditoQuery = `
      SELECT COALESCE(SUM(saldo), 0) as "totalCredito" 
      FROM cuentas_por_cobrar cxc
      JOIN facturas f ON f.id_factura = cxc.id_factura
      WHERE f.creado_en::date = CURRENT_DATE AND f.estado = 'Emitida'
    `;
    const resCredito = await pool.query(creditoQuery);
    totalCredito = Number(resCredito.rows[0].totalCredito);

    return {
      facturasEmitidas: parseInt(resFacturas.rows[0].facturasEmitidas),
      totalFacturas: Number(resFacturas.rows[0].totalFacturas),
      totalEfectivo,
      totalTarjeta,
      totalTransferencia,
      totalCredito
    };
};

exports.obtener = async (id) => {
    const result = await pool.query(
        `SELECT f.*,p.nombre paciente_nombre,p.apellido paciente_apellido,p.cedula,p.direccion,p.telefono
         FROM facturas f LEFT JOIN pacientes p USING(id_paciente) WHERE id_factura=$1`, [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Factura no encontrada"), { status: 404 });
    result.rows[0].detalles = (await pool.query("SELECT * FROM factura_detalle WHERE id_factura=$1", [id])).rows;
    result.rows[0].pagos = (await pool.query("SELECT * FROM factura_pagos WHERE id_factura=$1", [id])).rows;
    return result.rows[0];
};

const validarVinculos = async (client, data) => {
    if (data.id_receta) {
        const r = await client.query("SELECT id_paciente,id_historia FROM recetas WHERE id_receta=$1", [data.id_receta]);
        if (!r.rows[0] || Number(r.rows[0].id_paciente) !== Number(data.id_paciente) ||
            (data.id_historia && Number(r.rows[0].id_historia) !== Number(data.id_historia))) {
            throw Object.assign(new Error("Receta, historia y paciente no corresponden"), { status: 409 });
        }
    }
    if (data.id_historia) {
        const h = await client.query("SELECT id_paciente FROM historias_clinicas WHERE id_historia=$1", [data.id_historia]);
        if (!h.rows[0] || Number(h.rows[0].id_paciente) !== Number(data.id_paciente)) {
            throw Object.assign(new Error("La historia no corresponde al paciente"), { status: 409 });
        }
    }
};

// Crear factura (sin cambios)
exports.crear = async (data, usuario, req) => {
    const detalles = Array.isArray(data.detalles) ? data.detalles : [];
    const pagos = Array.isArray(data.pagos) ? data.pagos : [];
    if (!detalles.length) throw Object.assign(new Error("La factura requiere detalles"), { status: 400 });
    if (detalles.some((d) => !d.descripcion || Number(d.cantidad) <= 0 || Number(d.precio_unitario) < 0)) {
        throw Object.assign(new Error("Detalle de factura inválido"), { status: 400 });
    }
    if (pagos.some((p) => !formas.includes(p.forma_pago) || Number(p.monto) <= 0)) {
        throw Object.assign(new Error("Forma o monto de pago inválido"), { status: 400 });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await validarVinculos(client, data);
        const subtotal = money(detalles.reduce((sum,d) => sum + Number(d.cantidad) * Number(d.precio_unitario), 0));
        let descuento = money(data.descuento || 0);
        let promocion = null;
        if (data.id_promocion) {
            const p = await client.query(
                "SELECT * FROM promociones WHERE id_promocion=$1 AND activo=TRUE", [data.id_promocion]
            );
            promocion = p.rows[0];
            if (!promocion) throw Object.assign(new Error("Promoción no disponible"), { status: 400 });
            if (promocion.requiere_permiso && usuario.rol !== "Administrador") {
                throw Object.assign(new Error("La promoción requiere autorización administrativa"), { status: 403 });
            }
            descuento = money(descuento + subtotal * Number(promocion.porcentaje) / 100);
        }
        if (descuento > 0 && usuario.rol !== "Administrador" && !promocion) {
            throw Object.assign(new Error("El descuento requiere autorización administrativa"), { status: 403 });
        }
        if (descuento < 0 || descuento > subtotal) throw Object.assign(new Error("Descuento inválido"), { status: 400 });
        const impuestos = money(data.impuestos || 0);
        const total = money(subtotal - descuento + impuestos);
        const pagado = money(pagos.reduce((sum,p) => sum + Number(p.monto), 0));
        if (pagado > total) throw Object.assign(new Error("Los pagos superan el total"), { status: 400 });

        if ((pagado < total || pagos.some((p) => p.forma_pago === "Credito")) && !data.id_paciente) {
            throw Object.assign(new Error("El crédito requiere un paciente identificado"), { status: 400 });
        }
        if (pagado < total) {
            const vencidas = await client.query(
                "SELECT 1 FROM cuentas_por_cobrar WHERE id_paciente=$1 AND saldo>0 AND fecha_vencimiento<CURRENT_DATE LIMIT 1",
                [data.id_paciente]
            );
            if (vencidas.rowCount) throw Object.assign(new Error("Cliente bloqueado por saldos vencidos"), { status: 409 });
        }

        const caja = await client.query(
            "SELECT id_caja_turno FROM caja_turnos WHERE id_cajero=$1 AND estado='Abierta' ORDER BY abierto_en DESC LIMIT 1 FOR UPDATE",
            [usuario.id]
        );
        if (!caja.rows[0]) throw Object.assign(new Error("Debe abrir caja antes de facturar"), { status: 409 });
        const numero = data.numero_factura || `FAC-${new Date().toISOString().replace(/\D/g, "").slice(0,17)}`;
        const factura = await client.query(
            `INSERT INTO facturas(id_paciente,id_receta,id_historia,id_caja_turno,numero_factura,subtotal,
             descuento,impuestos,total,id_promocion,autorizacion_fiscal, es_simulada)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12) RETURNING *`,
            [data.id_paciente || null,data.id_receta || null,data.id_historia || null,caja.rows[0].id_caja_turno,
             numero,subtotal,descuento,impuestos,total,data.id_promocion || null,data.autorizacion_fiscal || null,
             data.es_simulada || false]
        );
        for (const detalle of detalles) {
            const lineaTotal = money(Number(detalle.cantidad) * Number(detalle.precio_unitario));
            await client.query(
                `INSERT INTO factura_detalle(id_factura,id_producto,descripcion,cantidad,precio_unitario,total)
                 VALUES($1,$2,$3,$4,$5,$6)`,
                [factura.rows[0].id_factura,detalle.id_producto || null,detalle.descripcion,
                 Number(detalle.cantidad),Number(detalle.precio_unitario),lineaTotal]
            );
            if (detalle.id_producto) {
                const stock = await client.query(
                    "UPDATE productos SET stock=stock-$1 WHERE id_producto=$2 AND activo=TRUE AND stock >= $1 RETURNING id_producto",
                    [Number(detalle.cantidad),detalle.id_producto]
                );
                if (!stock.rowCount) throw Object.assign(new Error(`Stock insuficiente para ${detalle.descripcion}`), { status: 409 });
            }
        }
        for (const pago of pagos) {
            await client.query(
                "INSERT INTO factura_pagos(id_factura,forma_pago,monto,referencia) VALUES($1,$2,$3,$4)",
                [factura.rows[0].id_factura,pago.forma_pago,money(pago.monto),pago.referencia || null]
            );
        }
        if (total > pagado) {
            await client.query(
                `INSERT INTO cuentas_por_cobrar(id_paciente,id_factura,saldo,fecha_vencimiento)
                 VALUES($1,$2,$3,CURRENT_DATE+$4::integer)`,
                [data.id_paciente,factura.rows[0].id_factura,money(total-pagado),Math.max(Number(data.dias_credito || 30),0)]
            );
        }
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "FACTURA_EMITIDA", tabla: "facturas", registroId: factura.rows[0].id_factura, detalle: { total }, req });
        return factura.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};

// Anular factura (sin cambios)
exports.anular = async (id, data, usuario, req) => {
    if (!String(data.motivo || "").trim()) throw Object.assign(new Error("El motivo es obligatorio"), { status: 400 });
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const factura = await client.query("UPDATE facturas SET estado='Anulada' WHERE id_factura=$1 AND estado='Emitida' RETURNING *", [id]);
        if (!factura.rowCount) throw Object.assign(new Error("Factura no disponible para anulación"), { status: 409 });
        const detalles = await client.query("SELECT id_producto,cantidad FROM factura_detalle WHERE id_factura=$1", [id]);
        for (const d of detalles.rows) if (d.id_producto) await client.query("UPDATE productos SET stock=stock+$1 WHERE id_producto=$2", [d.cantidad,d.id_producto]);
        await client.query("UPDATE cuentas_por_cobrar SET saldo=0,estado='Pagada',credito_bloqueado=FALSE WHERE id_factura=$1", [id]);
        await client.query("INSERT INTO notas_credito(id_factura,motivo,monto,id_usuario) VALUES($1,$2,$3,$4)", [id,data.motivo,factura.rows[0].total,usuario.id]);
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "FACTURA_ANULADA", tabla: "facturas", registroId: Number(id), detalle: { motivo: data.motivo }, req });
        return factura.rows[0];
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};

// ✅ CORREGIDO: Devolver (parcial o total) actualizando cartera
exports.devolver = async (id, data, usuario, req) => {
    const monto = money(data.monto);
    if (!String(data.motivo || "").trim() || monto <= 0) throw Object.assign(new Error("Motivo y monto válido son obligatorios"), { status: 400 });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Obtener factura con bloqueo
        const factura = await client.query("SELECT * FROM facturas WHERE id_factura=$1 FOR UPDATE", [id]);
        if (!factura.rows[0] || factura.rows[0].estado !== "Emitida") {
            throw Object.assign(new Error("Factura no disponible para devolución"), { status: 409 });
        }

        const totalFactura = Number(factura.rows[0].total);

        // Obtener el total pagado hasta ahora
        const pagos = await client.query(
            "SELECT COALESCE(SUM(monto), 0) AS pagado FROM factura_pagos WHERE id_factura = $1",
            [id]
        );
        const pagado = Number(pagos.rows[0].pagado);

        // Obtener el saldo actual de la factura (cuenta por cobrar)
        const cuenta = await client.query(
            "SELECT id_cxc, saldo FROM cuentas_por_cobrar WHERE id_factura = $1 FOR UPDATE",
            [id]
        );
        let saldoActual = cuenta.rows[0] ? Number(cuenta.rows[0].saldo) : 0;
        // Si no hay cuenta por cobrar, el saldo es 0 (ya está pagada)
        if (saldoActual <= 0 && pagado >= totalFactura) {
            // Ya está totalmente pagada, pero aún se puede devolver (ej. devolución de todo el pago)
            // En ese caso, el monto a devolver no puede superar el pagado
            if (monto > pagado) throw Object.assign(new Error("El monto a devolver no puede superar lo pagado"), { status: 400 });
        } else {
            // Si hay saldo, el monto a devolver no puede superar el saldo (porque es lo que debe)
            // Pero en realidad se puede devolver cualquier monto hasta el pagado, no solo el saldo.
            // El saldo es lo que falta pagar, pero si el cliente pagó 100 y debe 20, puede devolver 100? No, solo puede devolver lo que pagó.
            // La lógica correcta: el monto devuelto no puede superar el pagado.
            if (monto > pagado) throw Object.assign(new Error("El monto a devolver no puede superar lo pagado"), { status: 400 });
        }

        // Registrar la devolución
        await client.query(
            "INSERT INTO devoluciones(id_factura,id_usuario,motivo,monto) VALUES($1,$2,$3,$4)",
            [id, usuario.id, data.motivo, monto]
        );

        // Registrar nota de crédito
        await client.query(
            "INSERT INTO notas_credito(id_factura,motivo,monto,id_usuario) VALUES($1,$2,$3,$4)",
            [id, data.motivo, monto, usuario.id]
        );

        // Reponer stock si se solicita
        if (data.reponer_stock === true) {
            const detalles = await client.query(
                "SELECT id_producto, cantidad FROM factura_detalle WHERE id_factura = $1",
                [id]
            );
            for (const d of detalles.rows) {
                if (d.id_producto) {
                    await client.query(
                        "UPDATE productos SET stock = stock + $1 WHERE id_producto = $2",
                        [Number(d.cantidad), d.id_producto]
                    );
                }
            }
        }

        // Actualizar cuentas por cobrar si existe
        if (cuenta.rows[0]) {
            const nuevoSaldo = money(saldoActual - monto);
            if (nuevoSaldo <= 0) {
                // Si el saldo queda en cero, marcar la cuenta como pagada y la factura como devuelta
                await client.query(
                    "UPDATE cuentas_por_cobrar SET saldo = 0, estado = 'Pagada', credito_bloqueado = FALSE WHERE id_cxc = $1",
                    [cuenta.rows[0].id_cxc]
                );
                await client.query(
                    "UPDATE facturas SET estado = 'Devuelta' WHERE id_factura = $1",
                    [id]
                );
            } else {
                // Si queda saldo, actualizar solo el saldo
                await client.query(
                    "UPDATE cuentas_por_cobrar SET saldo = $1 WHERE id_cxc = $2",
                    [nuevoSaldo, cuenta.rows[0].id_cxc]
                );
                // La factura permanece en 'Emitida'
            }
        } else {
            // Si no hay cuenta por cobrar (factura totalmente pagada), solo cambiamos el estado a devuelta si se devuelve todo lo pagado
            // o si el monto devuelto es igual al pagado (devolución total)
            if (monto >= pagado) {
                await client.query(
                    "UPDATE facturas SET estado = 'Devuelta' WHERE id_factura = $1",
                    [id]
                );
            }
            // Si no se devuelve todo, la factura sigue en 'Emitida' pero ya no tiene deuda
        }

        await client.query("COMMIT");
        await audit({
            idUsuario: usuario.id,
            accion: "DEVOLUCION_REGISTRADA",
            tabla: "devoluciones",
            registroId: id,
            detalle: { monto, factura_id: id },
            req
        });

        return { mensaje: "Devolución procesada correctamente", monto_devuelto: monto };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

// Promociones (sin cambios)
exports.promociones = async () => (await pool.query("SELECT * FROM promociones ORDER BY nombre")).rows;
exports.crearPromocion = async (data) => (await pool.query("INSERT INTO promociones(nombre,porcentaje,requiere_permiso,activo) VALUES($1,$2,$3,$4) RETURNING *",[data.nombre,Number(data.porcentaje),data.requiere_permiso !== false,data.activo !== false])).rows[0];
exports.actualizarPromocion = async (id,data) => { const r=await pool.query("UPDATE promociones SET nombre=$1,porcentaje=$2,requiere_permiso=$3,activo=$4 WHERE id_promocion=$5 RETURNING *",[data.nombre,Number(data.porcentaje),data.requiere_permiso !== false,data.activo !== false,id]);if(!r.rows[0])throw Object.assign(new Error("Promoción no encontrada"),{status:404});return r.rows[0]; };
exports.eliminarPromocion = async (id) => { const r=await pool.query("UPDATE promociones SET activo=FALSE WHERE id_promocion=$1 RETURNING *",[id]);if(!r.rows[0])throw Object.assign(new Error("Promoción no encontrada"),{status:404});return r.rows[0]; };

// ==================== PEDIDOS WEB (PACIENTE -> CAJERO) ====================
// (Sin cambios en el resto del archivo)

exports.checkoutEcommerce = async (data, usuario, req) => {
    const detalles = Array.isArray(data.detalles) ? data.detalles : [];
    if (!detalles.length) throw Object.assign(new Error("El pedido requiere productos"), { status: 400 });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        let p = await client.query("SELECT id_paciente FROM pacientes WHERE correo=$1", [usuario.correo]);
        let id_paciente = p.rows[0]?.id_paciente;
        if (!id_paciente) {
            const u = await client.query("SELECT * FROM usuarios WHERE id_usuario=$1", [usuario.id]);
            const row = u.rows[0];
            const p2 = await client.query(
                "INSERT INTO pacientes(nombre,apellido,correo,cedula,telefono,fecha_nacimiento,genero,ocupacion,lugar_nacimiento,direccion) VALUES($1,$2,$3,$4,$5,CURRENT_DATE,'Otro','Sin especificar','Sin especificar','Sin especificar') RETURNING id_paciente",
                [row.nombre, row.apellido || '', row.correo, row.cedula || '0000000000', row.telefono || '0000000000']
            );
            id_paciente = p2.rows[0].id_paciente;
        }

        const subtotal = money(detalles.reduce((s, d) => s + Number(d.cantidad) * Number(d.precio_unitario), 0));

        const pedido = await client.query(
            `INSERT INTO pedidos_pendientes(id_paciente, subtotal, impuestos, total, observaciones)
             VALUES($1, $2, 0, $3, $4) RETURNING *`,
            [id_paciente, subtotal, subtotal, data.observaciones || null]
        );
        const id_pedido = pedido.rows[0].id_pedido;

        for (const d of detalles) {
            await client.query(
                `INSERT INTO pedido_detalle(id_pedido, id_producto, cantidad, precio_unitario)
                 VALUES($1, $2, $3, $4)`,
                [id_pedido, d.id_producto || null, Number(d.cantidad), Number(d.precio_unitario)]
            );
        }

        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "PEDIDO_WEB_CREADO", tabla: "pedidos_pendientes", registroId: id_pedido, req });
        return pedido.rows[0];
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

exports.listarPedidos = async () => {
    const r = await pool.query(
        `SELECT pp.*,
                p.nombre paciente_nombre, p.apellido paciente_apellido, p.telefono paciente_telefono,
                json_agg(json_build_object(
                    'id_detalle', pd.id_detalle,
                    'id_producto', pd.id_producto,
                    'nombre_producto', pr.nombre,
                    'sku', pr.sku,
                    'codigo_barra', pr.codigo_barra,
                    'cantidad', pd.cantidad,
                    'precio_unitario', pd.precio_unitario
                ) ORDER BY pd.id_detalle) AS detalles
         FROM pedidos_pendientes pp
         JOIN pacientes p USING(id_paciente)
         LEFT JOIN pedido_detalle pd USING(id_pedido)
         LEFT JOIN productos pr ON pr.id_producto = pd.id_producto
         WHERE pp.estado = 'PENDIENTE'
         GROUP BY pp.id_pedido, p.nombre, p.apellido, p.telefono
         ORDER BY pp.fecha_solicitud DESC`
    );
    return r.rows;
};

exports.listarPedidosPaciente = async (id_paciente) => {
    const r = await pool.query(
        `SELECT pp.*,
                json_agg(json_build_object(
                    'id_detalle', pd.id_detalle,
                    'id_producto', pd.id_producto,
                    'nombre_producto', pr.nombre,
                    'sku', pr.sku,
                    'codigo_barra', pr.codigo_barra,
                    'cantidad', pd.cantidad,
                    'precio_unitario', pd.precio_unitario
                ) ORDER BY pd.id_detalle) AS detalles
         FROM pedidos_pendientes pp
         LEFT JOIN pedido_detalle pd USING(id_pedido)
         LEFT JOIN productos pr ON pr.id_producto = pd.id_producto
         WHERE pp.id_paciente = $1
         GROUP BY pp.id_pedido
         ORDER BY pp.fecha_solicitud DESC`,
        [id_paciente]
    );
    return r.rows;
};

exports.confirmarPedido = async (id, data, usuario, req) => {
    const pagos = Array.isArray(data.pagos) ? data.pagos : [];
    if (!pagos.length) throw Object.assign(new Error("Debe registrar al menos un pago"), { status: 400 });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const pedido = await client.query("SELECT * FROM pedidos_pendientes WHERE id_pedido=$1 FOR UPDATE", [id]);
        if (!pedido.rows[0]) throw Object.assign(new Error("Pedido no encontrado"), { status: 404 });
        if (pedido.rows[0].estado !== "PENDIENTE") throw Object.assign(new Error("El pedido no está en estado PENDIENTE"), { status: 400 });

        const p = pedido.rows[0];
        const total = Number(p.total);
        const pagado = money(pagos.reduce((s, pago) => s + Number(pago.monto), 0));
        if (pagado > total) throw Object.assign(new Error("Los pagos superan el total"), { status: 400 });
        if (pagado < total) {
            throw Object.assign(new Error("El pago debe cubrir el total del pedido"), { status: 400 });
        }

        const c = await client.query(
            "SELECT id_caja_turno FROM caja_turnos WHERE id_cajero=$1 AND estado='Abierta' ORDER BY abierto_en DESC LIMIT 1 FOR UPDATE",
            [usuario.id]
        );
        if (!c.rows[0]) throw Object.assign(new Error("Debe abrir caja antes de cobrar"), { status: 409 });

        const impuestos = Number(p.impuestos) || 0;
        const numero = `FAC-${new Date().toISOString().replace(/\D/g, "").slice(0, 17)}`;
        const f = await client.query(
            `INSERT INTO facturas(id_paciente, id_caja_turno, numero_factura, subtotal, descuento, impuestos, total, estado, es_simulada)
             VALUES($1,$2,$3,$4,0,$5,$6,'Emitida',false) RETURNING *`,
            [p.id_paciente, c.rows[0].id_caja_turno, numero, p.subtotal, impuestos, total]
        );
        const id_factura = f.rows[0].id_factura;

        const detalles = await client.query(
            `SELECT pd.*, pr.nombre, pr.sku, pr.codigo_barra 
             FROM pedido_detalle pd 
             LEFT JOIN productos pr ON pr.id_producto = pd.id_producto 
             WHERE pd.id_pedido = $1`,
            [id]
        );
        for (const d of detalles.rows) {
            await client.query(
                `INSERT INTO factura_detalle(id_factura,id_producto,descripcion,cantidad,precio_unitario,total)
                 VALUES($1,$2,$3,$4,$5,$6)`,
                [id_factura, d.id_producto, d.nombre || `Producto ID ${d.id_producto}`, Number(d.cantidad), Number(d.precio_unitario), money(Number(d.cantidad) * Number(d.precio_unitario))]
            );
            if (d.id_producto) {
                const s = await client.query("UPDATE productos SET stock=stock-$1 WHERE id_producto=$2 RETURNING stock", [Number(d.cantidad), d.id_producto]);
                if (!s.rows[0] || Number(s.rows[0].stock) < 0) throw Object.assign(new Error(`Stock insuficiente para ${d.nombre}`), { status: 409 });
            }
        }

        for (const pago of pagos) {
            await client.query(
                "INSERT INTO factura_pagos(id_factura,forma_pago,monto,referencia) VALUES($1,$2,$3,$4)",
                [id_factura, pago.forma_pago, Number(pago.monto), pago.referencia || null]
            );
        }

        // Pago completo, no hay saldo
        await client.query("UPDATE pedidos_pendientes SET estado='COMPLETADO' WHERE id_pedido=$1", [id]);

        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "PEDIDO_CONFIRMADO", tabla: "pedidos_pendientes", registroId: Number(id), detalle: { id_factura }, req });
        return { mensaje: "Pedido confirmado y factura generada", id_factura, numero_factura: numero };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

exports.cancelarPedido = async (id, usuario, req) => {
    const r = await pool.query("UPDATE pedidos_pendientes SET estado='CANCELADO' WHERE id_pedido=$1 AND estado='PENDIENTE' RETURNING *", [id]);
    if (!r.rows[0]) throw Object.assign(new Error("Pedido no encontrado o ya procesado"), { status: 404 });
    await audit({ idUsuario: usuario.id, accion: "PEDIDO_CANCELADO", tabla: "pedidos_pendientes", registroId: Number(id), req });
    return r.rows[0];
};

exports.misPedidos = async (id_usuario) => {
    const p = await pool.query("SELECT id_paciente FROM pacientes WHERE correo = (SELECT correo FROM usuarios WHERE id_usuario=$1)", [id_usuario]);
    if (!p.rows[0]) return [];
    return exports.listarPedidosPaciente(p.rows[0].id_paciente);
};