const express = require("express");
const auth = require("../../middleware/auth.middleware");
const responder = require("../../utils/http");
const pool = require("../../config/database");

const router = express.Router();
router.get("/", auth, responder(async (req) => {
    const [pacientes,citas,stock,historias] = await Promise.all([
        pool.query("SELECT COUNT(*)::int total FROM pacientes WHERE activo=TRUE"),
        pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE pago_previo)::int pagadas,
                    COUNT(*) FILTER(WHERE estado='Pendiente')::int pendientes
                    FROM citas WHERE fecha_cita=CURRENT_DATE`),
        pool.query("SELECT COUNT(*)::int total FROM productos WHERE activo=TRUE AND stock<=stock_minimo"),
        pool.query("SELECT COUNT(*)::int total FROM historias_clinicas WHERE creado_en::date=CURRENT_DATE")
    ]);
    const result = {
        pacientes: pacientes.rows[0].total,
        citas_hoy: citas.rows[0].total,
        citas_pagadas: citas.rows[0].pagadas,
        citas_pendientes: citas.rows[0].pendientes,
        stock_bajo: stock.rows[0].total,
        atenciones_hoy: historias.rows[0].total
    };
    if (["Administrador", "Cajero"].includes(req.usuario.rol)) {
        const dinero = await pool.query(
            `SELECT COALESCE(SUM(total),0) ventas_hoy FROM facturas
             WHERE creado_en::date=CURRENT_DATE AND estado='Emitida'`
        );
        result.ventas_hoy = Number(dinero.rows[0].ventas_hoy);
    }
    return result;
}));

module.exports = router;
