const test = require("node:test");
const assert = require("node:assert/strict");

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

test("la integracion requiere una base aislada", { skip: !hasTestDatabase && "Defina TEST_DATABASE_URL con una base aislada" }, async () => {
    process.env.NODE_ENV = "test";
    const { checkSchema } = require("../../src/config/schemaCheck");
    const pool = require("../../src/config/database");
    try {
        const result = await checkSchema();
        assert.equal(result.ready, true, `Esquema incompleto: ${result.missing.join(", ")}`);
    } finally { await pool.end(); }
});
