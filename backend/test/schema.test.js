const test = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../src/config/database");

test("Supabase contiene el esquema operativo", async () => {
    const requeridas = [
        "usuarios", "auditoria", "pacientes", "citas", "pagos_previos",
        "historias_clinicas", "recetas", "pedidos_laboratorio", "productos",
        "ajustes_inventario", "proveedores", "ordenes_compra", "facturas",
        "factura_pagos", "caja_turnos", "cuentas_por_cobrar",
        "cuentas_por_pagar", "sesiones_usuario"
    ];
    const result = await pool.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema='public' AND table_name = ANY($1::text[])`,
        [requeridas]
    );
    assert.deepEqual(result.rows.map((r) => r.table_name).sort(), requeridas.sort());
});

test("las historias tienen bloqueo legal en base de datos", async () => {
    const result = await pool.query(
        "SELECT 1 FROM pg_trigger WHERE tgname='historias_bloqueo_legal' AND NOT tgisinternal"
    );
    assert.equal(result.rowCount, 1);
});

test("las tablas publicas tienen RLS activado", async () => {
    const result = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE NOT c.relrowsecurity)::int AS sin_rls
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind='r'`
    );
    assert.equal(result.rows[0].sin_rls, 0);
});

test.after(async () => pool.end());
