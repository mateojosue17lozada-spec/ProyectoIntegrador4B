const pool = require("../../config/database");
const audit = require("../../utils/audit");

const formas = ["Efectivo", "Tarjeta", "Transferencia", "Credito", "Mixto"];
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

exports.listar = async () => (await pool.query(
    `SELECT f.*,p.nombre paciente_nombre,p.apellido paciente_apellido
     FROM facturas f LEFT JOIN pacientes p USING(id_paciente) ORDER BY f.creado_en DESC`
)).rows;

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
             descuento,impuestos,total,id_promocion,autorizacion_fiscal)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [data.id_paciente || null,data.id_receta || null,data.id_historia || null,caja.rows[0].id_caja_turno,
             numero,subtotal,descuento,impuestos,total,data.id_promocion || null,data.autorizacion_fiscal || null]
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

exports.devolver = async (id, data, usuario, req) => {
    const monto = money(data.monto);
    if (!String(data.motivo || "").trim() || monto <= 0) throw Object.assign(new Error("Motivo y monto válido son obligatorios"), { status: 400 });
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const factura = await client.query("SELECT * FROM facturas WHERE id_factura=$1 FOR UPDATE", [id]);
        if (!factura.rows[0] || factura.rows[0].estado !== "Emitida" || monto > Number(factura.rows[0].total)) {
            throw Object.assign(new Error("Factura o monto no disponible"), { status: 409 });
        }
        const devolucion = await client.query(
            "INSERT INTO devoluciones(id_factura,id_usuario,motivo,monto) VALUES($1,$2,$3,$4) RETURNING *",
            [id,usuario.id,data.motivo,monto]
        );
        await client.query("INSERT INTO notas_credito(id_factura,motivo,monto,id_usuario) VALUES($1,$2,$3,$4)", [id,data.motivo,monto,usuario.id]);
        if (data.reponer_stock === true) {
            const detalles = await client.query("SELECT id_producto,cantidad FROM factura_detalle WHERE id_factura=$1", [id]);
            for (const d of detalles.rows) if (d.id_producto) await client.query("UPDATE productos SET stock=stock+$1 WHERE id_producto=$2", [d.cantidad,d.id_producto]);
        }
        await client.query("UPDATE facturas SET estado=CASE WHEN $1>=total THEN 'Devuelta' ELSE estado END WHERE id_factura=$2", [monto,id]);
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "DEVOLUCION_REGISTRADA", tabla: "devoluciones", registroId: devolucion.rows[0].id_devolucion, detalle: { monto }, req });
        return devolucion.rows[0];
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};

exports.promociones = async () => (await pool.query("SELECT * FROM promociones ORDER BY nombre")).rows;
exports.crearPromocion = async (data) => (await pool.query("INSERT INTO promociones(nombre,porcentaje,requiere_permiso,activo) VALUES($1,$2,$3,$4) RETURNING *",[data.nombre,Number(data.porcentaje),data.requiere_permiso !== false,data.activo !== false])).rows[0];
exports.actualizarPromocion = async (id,data) => { const r=await pool.query("UPDATE promociones SET nombre=$1,porcentaje=$2,requiere_permiso=$3,activo=$4 WHERE id_promocion=$5 RETURNING *",[data.nombre,Number(data.porcentaje),data.requiere_permiso !== false,data.activo !== false,id]);if(!r.rows[0])throw Object.assign(new Error("Promoción no encontrada"),{status:404});return r.rows[0]; };
exports.eliminarPromocion = async (id) => { const r=await pool.query("UPDATE promociones SET activo=FALSE WHERE id_promocion=$1 RETURNING *",[id]);if(!r.rows[0])throw Object.assign(new Error("Promoción no encontrada"),{status:404});return r.rows[0]; };
