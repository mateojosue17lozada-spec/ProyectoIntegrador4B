require("dotenv").config({ quiet: true });


const app = require("./app");
const ensureSchema = require("./config/ensureSchema");
const validateEnv = require("./config/validateEnv");
const { checkSchema } = require("./config/schemaCheck");
const pool = require("./config/database");
const logger = require("./utils/logger");


const PORT = process.env.PORT || 3000;


const iniciarServidor = async () => {
    try {
        validateEnv();
        if (process.env.ALLOW_RUNTIME_DDL === "true") await ensureSchema();
        try {
            const schema = await checkSchema();
            if (!schema.ready) {
                logger.warn("Servidor iniciado con base no disponible para trafico", {
                    eventCode: "SERVER_NOT_READY",
                    missingCount: schema.missing.length,
                    requiredMigrationApplied: schema.requiredMigrationApplied
                });
            }
        } catch (error) {
            logger.warn("Servidor iniciado sin conexion disponible a PostgreSQL", {
                eventCode: "SERVER_DATABASE_UNAVAILABLE",
                reason: error.code || error.name || "DATABASE_UNAVAILABLE"
            });
        }
        const server = app.listen(PORT, () => {
            logger.info("Servidor iniciado", { eventCode: "SERVER_STARTED", port: Number(PORT) });
        });
        let shuttingDown = false;
        const shutdown = async (signal) => {
            if (shuttingDown) return;
            shuttingDown = true;
            logger.info("Apagado iniciado", { eventCode: "SERVER_SHUTDOWN", signal });
            const timeout = setTimeout(() => process.exit(1), 10000);
            timeout.unref();
            server.close(async () => {
                await pool.end().catch(() => {});
                clearTimeout(timeout);
                process.exit(0);
            });
        };
        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error) {
        logger.error("No se pudo iniciar el servidor", { eventCode: "SERVER_START_FAILED", reason: error.message });
        await pool.end().catch(() => {});
        process.exit(1);
    }
};

iniciarServidor();
