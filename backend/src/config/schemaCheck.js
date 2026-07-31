const pool = require("./database");

const REQUIRED = {
    usuarios: ["id_usuario", "password", "intentos_fallidos", "bloqueado_hasta"],
    roles: ["id_rol", "nombre_rol"],
    sesiones_usuario: ["id_sesion", "id_usuario", "revocada_en", "expira_en"],
    recuperacion_password: ["id_usuario", "token", "expiracion", "usado"],
    auditoria: ["accion", "fecha"]
};
const REQUIRED_MIGRATION = "20260715120000";

const checkSchema = async (client = pool) => {
    await client.query("SELECT 1");
    const missing = [];
    for (const [table, columns] of Object.entries(REQUIRED)) {
        const result = await client.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema='public' AND table_name=$1 AND column_name=ANY($2::text[])`,
            [table, columns]
        );
        const found = new Set(result.rows.map((row) => row.column_name));
        for (const column of columns) if (!found.has(column)) missing.push(`${table}.${column}`);
    }
    let migrations = null;
    let requiredMigrationApplied = false;
    try {
        migrations = (await client.query("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1")).rows[0]?.version || null;
        requiredMigrationApplied = Boolean((await client.query(
            "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1 LIMIT 1",
            [REQUIRED_MIGRATION]
        )).rowCount);
    } catch { migrations = null; }
    return { ready: missing.length === 0 && requiredMigrationApplied, missing, migrationVersion: migrations, requiredMigrationApplied };
};

module.exports = { checkSchema, REQUIRED, REQUIRED_MIGRATION };
