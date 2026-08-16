require("dotenv").config({ quiet: true });

const { Pool, types } = require("pg");
const logger = require("../utils/logger");
const { validateTestDatabaseEnvironment } = require("./testDatabaseSafety");

// Configurar parser para TIMESTAMP (OID 1114) para tratar timestamps sin zona horaria como UTC ISO strings
types.setTypeParser(1114, (val) => {
    if (!val) return null;
    return val.replace(" ", "T") + "Z";
});

// Configurar parser para TIMESTAMPTZ (OID 1184)
types.setTypeParser(1184, (val) => {
    if (!val) return null;
    return new Date(val).toISOString();
});

const isTest = process.env.NODE_ENV === "test";
const connectionString = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

if (isTest) validateTestDatabaseEnvironment();

const usarSsl = process.env.DB_SSL === "true" || /supabase|render|railway|neon|amazonaws/i.test(connectionString || "");

const pool = new Pool({
    connectionString,
    ssl: usarSsl ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
    logger.error("Error inesperado en el pool de PostgreSQL", { code: error.code });
});

module.exports = pool;
