require("dotenv").config({ quiet: true });

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { validateTestDatabaseEnvironment } = require("../config/testDatabaseSafety");

const command = process.argv[2] || "check";
const migrationsDir = path.resolve(__dirname, "../../../supabase/migrations");

const main = async () => {
    const target = validateTestDatabaseEnvironment();
    console.log(`Base de pruebas validada: host=${target.host} database=${target.database}`);
    const pool = new Pool({ connectionString: target.connectionString, ssl: /supabase|neon|amazonaws/i.test(target.host) ? { rejectUnauthorized: false } : false });
    try {
        if (command === "check") {
            const { checkSchema } = require("../config/schemaCheck");
            const result = await checkSchema(pool);
            console.log(JSON.stringify({ ready: result.ready, missing: result.missing, migrationVersion: result.migrationVersion }));
            if (!result.ready) process.exitCode = 1;
            return;
        }
        if (command !== "migrate") throw new Error(`Comando desconocido: ${command}`);

        await pool.query("CREATE SCHEMA IF NOT EXISTS supabase_migrations");
        await pool.query(`CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
            version text PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
        )`);
        const files = fs.readdirSync(migrationsDir).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
        for (const file of files) {
            const version = file.split("_")[0];
            const exists = await pool.query("SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1", [version]);
            if (exists.rowCount) { console.log(`Omitida (ya aplicada): ${file}`); continue; }
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                await client.query(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
                await client.query("INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES($1,$2)", [version, file]);
                await client.query("COMMIT");
                console.log(`Aplicada: ${file}`);
            } catch (error) {
                await client.query("ROLLBACK");
                const safe = new Error(`Fallo aplicando ${file} (${error.code || "SQL_ERROR"})`);
                safe.cause = error;
                throw safe;
            } finally { client.release(); }
        }
    } finally { await pool.end(); }
};

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
