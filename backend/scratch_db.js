const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.tbksfjsqarspcdzqnjim:Lozadamateo12.@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function alterDevoluciones() {
    try {
        await pool.query(`ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(50) DEFAULT 'Efectivo';`);
        console.log("Column forma_pago added to devoluciones.");
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
alterDevoluciones();
