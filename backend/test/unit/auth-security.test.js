const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const logger = require("../../src/utils/logger");

const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("el logger redacta secretos anidados y arreglos", () => {
    const value = logger.redact({ token: "abc", nested: { password: "secret", ok: 1 }, list: [{ authorization: "Bearer abc" }] });
    assert.deepEqual(value, { token: "[REDACTED]", nested: { password: "[REDACTED]", ok: 1 }, list: [{ authorization: "[REDACTED]" }] });
});

test("el logger no altera contexto permitido", () => {
    assert.deepEqual(logger.redact({ eventCode: "LOGIN_FAILED", userId: 2 }), { eventCode: "LOGIN_FAILED", userId: 2 });
});

test("el middleware no contiene vistas previas de JWT", () => {
    const source = read("src/middleware/auth.middleware.js");
    assert.doesNotMatch(source, /tokenPreview|slice\(0,\s*12\)/);
    assert.match(source, /AUTH_DEBUG === "true"/);
});

test("el controlador usa un mensaje externo generico", () => {
    const source = read("src/modules/auth/auth.controller.js");
    assert.match(source, /Usuario o contraseña incorrectos\./);
    assert.doesNotMatch(source, /Cuenta bloqueada|Intento \$\{/);
});

test("el contador usa una actualizacion atomica", () => {
    const source = read("src/modules/auth/auth.service.js");
    assert.match(source, /intentos_fallidos = LEAST\(intentos_fallidos \+ 1/);
    assert.match(source, /RETURNING intentos_fallidos, bloqueado/);
    assert.doesNotMatch(source, /usuario\.intentos_fallidos \|\| 0\) \+ 1/);
});

test("el bloqueo temporal es configurable y acotado", () => {
    const source = read("src/modules/auth/auth.service.js");
    assert.match(source, /LOGIN_LOCK_MINUTES/);
    assert.match(source, /bloqueado_hasta/);
    assert.match(source, /Math\.min\(value, 1440\)/);
});

test("un login correcto limpia contador y bloqueo", () => {
    const source = read("src/modules/auth/auth.service.js");
    assert.match(source, /ultimo_login=NOW\(\),intentos_fallidos=0,bloqueado=FALSE,bloqueado_hasta=NULL/);
});

test("la recuperacion exige usuario activo y revoca sesiones", () => {
    const source = read("src/modules/auth/auth.service.js");
    assert.match(source, /u\.estado = TRUE/);
    assert.match(source, /UPDATE sesiones_usuario SET revocada_en = NOW\(\)/);
});

test("en pruebas el correo real esta deshabilitado", () => {
    assert.match(read("src/utils/email.js"), /NODE_ENV === "test"\) return true/);
});

test("la migracion agrega solo los campos de bloqueo faltantes", () => {
    const migration = read("../supabase/migrations/20260715120000_auth_temporary_locking.sql");
    assert.match(migration, /ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ/);
    assert.match(migration, /ultimo_intento_fallido_en TIMESTAMPTZ/);
    assert.doesNotMatch(migration, /DROP|TRUNCATE|DELETE FROM/i);
});

test("el DDL de arranque esta desactivado y prohibido en produccion", () => {
    const server = read("src/server.js");
    const ensure = read("src/config/ensureSchema.js");
    assert.match(server, /ALLOW_RUNTIME_DDL === "true"/);
    assert.match(ensure, /NODE_ENV === "production"/);
});

test("health no consulta la base y readiness si verifica esquema", () => {
    const app = read("src/app.js");
    assert.match(app, /app\.get\("\/health"/);
    assert.match(app, /app\.get\("\/ready"/);
    assert.match(app, /checkSchema\(\)/);
    const schema = read("src/config/schemaCheck.js");
    assert.match(schema, /REQUIRED_MIGRATION = "20260715120000"/);
    assert.match(schema, /missing\.length === 0 && requiredMigrationApplied/);
});

test("el servidor permanece vivo si PostgreSQL no esta disponible", () => {
    const server = read("src/server.js");
    assert.match(server, /SERVER_DATABASE_UNAVAILABLE/);
    assert.match(server, /app\.listen/);
    assert.doesNotMatch(server, /if \(!schema\.ready\) throw/);
});
