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
        ,"cie10_catalogo"
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

test("la base de datos impide atención sin pago previo", async (t) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const user = await client.query("SELECT id_usuario FROM usuarios ORDER BY id_usuario LIMIT 1");
        if (!user.rows[0]) return t.skip("No existe un usuario para construir el escenario");
        const patient = await client.query(
            "INSERT INTO pacientes(nombre,apellido,cedula) VALUES('Prueba','Pago',$1) RETURNING id_paciente",
            [`TEST-${Date.now()}`]
        );
        const appointment = await client.query(
            `INSERT INTO citas(id_paciente,id_usuario,fecha_cita,hora_cita,motivo)
             VALUES($1,$2,CURRENT_DATE,CURRENT_TIME,'Prueba automatizada') RETURNING id_cita`,
            [patient.rows[0].id_paciente,user.rows[0].id_usuario]
        );
        await assert.rejects(
            client.query(
                "INSERT INTO historias_clinicas(id_paciente,id_cita,id_optometra) VALUES($1,$2,$3)",
                [patient.rows[0].id_paciente,appointment.rows[0].id_cita,user.rows[0].id_usuario]
            ),
            /pago previo/i
        );
    } finally {
        await client.query("ROLLBACK").catch(() => {});
        client.release();
    }
});

test("el catálogo clínico y los controles de consistencia están instalados", async () => {
    const result = await pool.query(
        `SELECT
          EXISTS(SELECT 1 FROM cie10_catalogo WHERE codigo='H52.1') cie10,
          EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='historias_validar_pago' AND NOT tgisinternal) pago,
          EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='auditoria_inmutable' AND NOT tgisinternal) auditoria`
    );
    assert.deepEqual(result.rows[0], { cie10: true, pago: true, auditoria: true });
});

test.after(async () => pool.end());
