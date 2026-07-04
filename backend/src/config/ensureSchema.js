const pool = require("./database");

const ensureSchema = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS auditoria (
            id_auditoria BIGSERIAL PRIMARY KEY,
            id_usuario INTEGER,
            accion VARCHAR(100) NOT NULL,
            tabla_afectada VARCHAR(100),
            fecha TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query("ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS id_registro INTEGER");
    await pool.query("ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS detalle JSONB");
    await pool.query("ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS ip VARCHAR(80)");
    await pool.query("ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS user_agent TEXT");
    await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0");
    await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT FALSE");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS recuperacion_password (
            id_recuperacion BIGSERIAL PRIMARY KEY,
            id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
            token VARCHAR(255) NOT NULL,
            expiracion TIMESTAMP NOT NULL,
            usado BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);

    await pool.query("ALTER TABLE recuperacion_password ALTER COLUMN usado SET DEFAULT FALSE");
    await pool.query("UPDATE recuperacion_password SET usado = FALSE WHERE usado IS NULL");
    await pool.query("ALTER TABLE recuperacion_password ALTER COLUMN usado SET NOT NULL");

    await pool.query(`
        CREATE INDEX IF NOT EXISTS recuperacion_password_token_activo_idx
        ON recuperacion_password (token)
        WHERE usado = FALSE
    `);
};

module.exports = ensureSchema;
