require("dotenv").config({ quiet: true });

const { Pool } = require("pg");
const logger = require("../utils/logger");
const { validateTestDatabaseEnvironment } = require("./testDatabaseSafety");

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
