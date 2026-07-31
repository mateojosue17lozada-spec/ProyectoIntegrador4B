const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTestDatabaseEnvironment } = require("../../src/config/testDatabaseSafety");

const base = { NODE_ENV: "test", TEST_DATABASE_URL: "postgresql://user:secret@localhost/optocenter_test" };

test("acepta una base marcada exclusivamente para pruebas", () => {
    const result = validateTestDatabaseEnvironment(base);
    assert.deepEqual({ host: result.host, database: result.database }, { host: "localhost", database: "optocenter_test" });
});

test("rechaza que TEST_DATABASE_URL sea igual a DATABASE_URL", () => {
    assert.throws(() => validateTestDatabaseEnvironment({ ...base, DATABASE_URL: base.TEST_DATABASE_URL }), /no puede ser igual/);
});

test("rechaza nombre no marcado, nombre ausente y patrones prohibidos", () => {
    assert.throws(() => validateTestDatabaseEnvironment({ ...base, TEST_DATABASE_URL: "postgresql://u:p@localhost/optocenter" }), /debe incluir/);
    assert.throws(() => validateTestDatabaseEnvironment({ ...base, TEST_DATABASE_URL: "postgresql://u:p@localhost" }), /determinar/);
    assert.throws(() => validateTestDatabaseEnvironment({ ...base, TEST_DATABASE_FORBIDDEN_PATTERNS: "localhost" }), /patron productivo/);
});

test("rechaza operar fuera de NODE_ENV=test", () => {
    assert.throws(() => validateTestDatabaseEnvironment({ ...base, NODE_ENV: "development" }), /NODE_ENV=test/);
});
