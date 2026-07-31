require("dotenv").config();
const { checkSchema } = require("../config/schemaCheck");
const pool = require("../config/database");

(async () => {
    try {
        const result = await checkSchema();
        console.log(JSON.stringify({ ready: result.ready, missing: result.missing, migrationVersion: result.migrationVersion }));
        process.exitCode = result.ready ? 0 : 1;
    } catch (error) {
        console.error(JSON.stringify({ ready: false, error: "No se pudo verificar el esquema" }));
        process.exitCode = 1;
    } finally { await pool.end(); }
})();
