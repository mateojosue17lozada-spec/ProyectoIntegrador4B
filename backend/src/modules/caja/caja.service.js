const pool = require("../../config/database");
const audit = require("../../utils/audit");
exports.estado = async (id) => {
  const r = await pool.query(
    "SELECT * FROM caja_turnos WHERE id_cajero=$1 AND estado='Abierta' ORDER BY abierto_en DESC LIMIT 1",
    [id],
  );
  return r.rows[0] || null;
};
exports.abrir = async (data, u, req) => {
  if (await exports.estado(u.id))
    throw new Error("Ya existe una caja abierta para este cajero");
  const cerrada = await pool.query(
    "SELECT 1 FROM caja_turnos WHERE id_cajero=$1 AND fecha=CURRENT_DATE AND estado='Cerrada' LIMIT 1",
    [u.id],
  );
  if (cerrada.rowCount)
    throw Object.assign(
      new Error(
        "La caja diaria ya fue cerrada. No puede reabrirse hasta el siguiente día",
      ),
      { status: 409 },
    );
  const monto = Number(data.monto_apertura || 0);
  if (!Number.isFinite(monto) || monto < 0)
    throw Object.assign(new Error("Monto de apertura inválido"), {
      status: 400,
    });
  const r = await pool.query(
    "INSERT INTO caja_turnos(id_cajero,monto_apertura) VALUES($1,$2) RETURNING *",
    [u.id, monto],
  );
  await audit({
    idUsuario: u.id,
    accion: "CAJA_ABIERTA",
    tabla: "caja_turnos",
    registroId: r.rows[0].id_caja_turno,
    req,
  });
  return r.rows[0];
};
/**
 * Calcula el arqueo del turno abierto: totales por forma de pago (desde
 * factura_pagos del propio turno) y el efectivo esperado.
 *
 * Correccion del filtro (antes se sumaba por CURRENT_DATE, mezclando el efectivo
 * de todos los cajeros del dia): las ventas se filtran por id_caja_turno, y los
 * abonos y devoluciones en efectivo por la VENTANA TEMPORAL del turno
 * (abierto_en..ahora). abonos_cxc y devoluciones no guardan turno ni cajero, asi
 * que la ventana del turno es la atribucion mas precisa posible sin tocar su
 * esquema.
 */
const calcularArqueo = async (caja, cliente = pool) => {
  const porTipo = await cliente.query(
    `SELECT fp.forma_pago, COALESCE(SUM(fp.monto),0) total
     FROM factura_pagos fp JOIN facturas f USING(id_factura)
     WHERE f.id_caja_turno=$1 AND f.estado='Emitida'
     GROUP BY fp.forma_pago`,
    [caja.id_caja_turno]
  );
  const tot = (forma) => Number(porTipo.rows.find((r) => r.forma_pago === forma)?.total || 0);
  const totalEfectivo = tot("Efectivo");
  const totalTarjeta = tot("Tarjeta");
  const totalTransferencia = tot("Transferencia");
  const totalCredito = tot("Credito");

  const abonos = await cliente.query(
    `SELECT COALESCE(SUM(monto),0) total FROM abonos_cxc
     WHERE forma_pago='Efectivo' AND creado_en >= $1 AND creado_en <= NOW()`,
    [caja.abierto_en]
  );
  const devoluciones = await cliente.query(
    `SELECT COALESCE(SUM(monto),0) total FROM devoluciones
     WHERE forma_pago='Efectivo' AND creada_en >= $1 AND creada_en <= NOW()`,
    [caja.abierto_en]
  );

  const abono = Number(abonos.rows[0].total);
  const devolucion = Number(devoluciones.rows[0].total);
  const esperado = Number(caja.monto_apertura) + totalEfectivo + abono - devolucion;

  return {
    apertura: Number(caja.monto_apertura),
    total_efectivo: totalEfectivo,
    total_tarjeta: totalTarjeta,
    total_transferencia: totalTransferencia,
    total_credito: totalCredito,
    total_general: totalEfectivo + totalTarjeta + totalTransferencia + totalCredito,
    abonos_efectivo: abono,
    devoluciones_efectivo: devolucion,
    efectivo_esperado: esperado
  };
};

/** Resumen del turno abierto para previsualizar el arqueo en el frontend. */
exports.resumenTurno = async (idUsuario) => {
  const caja = await exports.estado(idUsuario);
  if (!caja) return null;
  return { id_caja_turno: caja.id_caja_turno, ...(await calcularArqueo(caja)) };
};

exports.cerrar = async (data, u, req) => {
  const caja = await exports.estado(u.id);
  if (!caja) throw Object.assign(new Error("No existe una caja abierta"), { status: 409 });

  const arqueo = await calcularArqueo(caja);
  const contado = Number(data.monto_cierre);
  if (!Number.isFinite(contado) || contado < 0)
    throw Object.assign(new Error("El efectivo declarado no es valido"), { status: 400 });

  // Efectivo que se retira al banco (deposito). El resto queda como fondo/vueltos.
  const retiroBanco = Number(data.retiro_banco || 0);
  if (!Number.isFinite(retiroBanco) || retiroBanco < 0)
    throw Object.assign(new Error("El retiro al banco no es valido"), { status: 400 });
  if (retiroBanco > contado)
    throw Object.assign(new Error("El retiro al banco no puede superar el efectivo contado"), { status: 400 });

  const fondoVueltos = Math.round((contado - retiroBanco) * 100) / 100;

  // Si el cajero declara el fondo que se queda, debe cuadrar con contado - retiro.
  if (data.efectivo_fondo !== undefined && data.efectivo_fondo !== null && data.efectivo_fondo !== "") {
    const fondoDeclarado = Number(data.efectivo_fondo);
    if (Math.abs(fondoDeclarado - fondoVueltos) > 0.01)
      throw Object.assign(
        new Error("El efectivo que se queda mas el retiro al banco debe igualar el efectivo contado"),
        { status: 400 }
      );
  }

  const diferencia = Math.round((contado - arqueo.efectivo_esperado) * 100) / 100;

  const r = await pool.query(
    `UPDATE caja_turnos SET
        monto_cierre=$1, ventas_efectivo=$2, efectivo_esperado=$3, diferencia=$4,
        observaciones=$5, total_efectivo=$6, total_tarjeta=$7, total_transferencia=$8,
        total_credito=$9, retiro_banco=$10, responsable=$11,
        estado='Cerrada', cerrado_en=NOW()
     WHERE id_caja_turno=$12 RETURNING *`,
    [
      contado, arqueo.total_efectivo, arqueo.efectivo_esperado, diferencia,
      data.observaciones || null, arqueo.total_efectivo, arqueo.total_tarjeta,
      arqueo.total_transferencia, arqueo.total_credito, retiroBanco,
      data.responsable || null, caja.id_caja_turno
    ]
  );

  await audit({
    idUsuario: u.id,
    accion: "CAJA_CERRADA",
    tabla: "caja_turnos",
    registroId: caja.id_caja_turno,
    detalle: { ...arqueo, contado, diferencia, retiro_banco: retiroBanco, fondo_vueltos: fondoVueltos },
    req
  });

  // Se devuelven los derivados (fondo, total_general) ademas de la fila.
  return { ...r.rows[0], fondo_vueltos: fondoVueltos, total_general: arqueo.total_general };
};
exports.historial = async (f, u) => {
  const values = [],
    where = [];
  if (u.rol !== "Administrador") {
    values.push(u.id);
    where.push(`c.id_cajero=$${values.length}`);
  } else if (f.cajero) {
    values.push(Number(f.cajero));
    where.push(`c.id_cajero=$${values.length}`);
  }
  if (f.desde) {
    values.push(f.desde);
    where.push(`c.abierto_en::date >= $${values.length}::date`);
  }
  if (f.hasta) {
    values.push(f.hasta);
    where.push(`c.abierto_en::date <= $${values.length}::date`);
  }
  return (
    await pool.query(
      `SELECT c.*,concat_ws(' ',u.nombre,u.apellido) AS cajero FROM caja_turnos c JOIN usuarios u ON u.id_usuario=c.id_cajero ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY abierto_en DESC`,
      values,
    )
  ).rows;
};
