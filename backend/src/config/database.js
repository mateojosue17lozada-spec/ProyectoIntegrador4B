require("dotenv").config();

const { Pool } = require("pg");

const usarSsl = process.env.DB_SSL === "true" || /supabase|render|railway|neon|amazonaws/i.test(process.env.DATABASE_URL || "");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: usarSsl ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
    console.error("Error inesperado en el pool de PostgreSQL:", error.message);
});

module.exports = pool;
