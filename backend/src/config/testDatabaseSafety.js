const TEST_NAME_PATTERN = /(test|prueba|ci)/i;

const parsePatterns = (value) => String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const validateTestDatabaseEnvironment = (env = process.env) => {
    if (env.NODE_ENV !== "test") throw new Error("NODE_ENV=test es obligatorio para operar la base de pruebas");
    const raw = env.TEST_DATABASE_URL;
    if (!raw) throw new Error("TEST_DATABASE_URL es obligatoria");
    if (env.DATABASE_URL && raw === env.DATABASE_URL) {
        throw new Error("TEST_DATABASE_URL no puede ser igual a DATABASE_URL");
    }

    let parsed;
    try { parsed = new URL(raw); } catch { throw new Error("TEST_DATABASE_URL no es una URL PostgreSQL valida"); }
    if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) throw new Error("TEST_DATABASE_URL debe usar PostgreSQL");
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).trim();
    if (!database) throw new Error("No se pudo determinar el nombre de la base de pruebas");
    if (!TEST_NAME_PATTERN.test(database)) throw new Error("La base de pruebas debe incluir test, prueba o ci en su nombre");

    const forbidden = parsePatterns(env.TEST_DATABASE_FORBIDDEN_PATTERNS || env.PRODUCTION_DATABASE_HOSTS);
    const target = `${parsed.hostname}/${database}`.toLowerCase();
    if (forbidden.some((pattern) => target.includes(pattern))) {
        throw new Error("TEST_DATABASE_URL coincide con un patron productivo prohibido");
    }

    return { connectionString: raw, host: parsed.hostname, database };
};

module.exports = { validateTestDatabaseEnvironment, TEST_NAME_PATTERN };
