module.exports = () => {
    const required = [process.env.NODE_ENV === "test" ? "TEST_DATABASE_URL" : "DATABASE_URL", "JWT_SECRET"];
    if (process.env.NODE_ENV === "production") required.push("DATA_ENCRYPTION_KEY");

    const missing = required.filter((name) => !String(process.env[name] || "").trim());
    if (missing.length) throw new Error(`Faltan variables requeridas: ${missing.join(", ")}`);
    if (String(process.env.JWT_SECRET).length < 32) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
        }
        console.warn("Advertencia: use un JWT_SECRET de al menos 32 caracteres antes de producción");
    }
    if (process.env.DATA_ENCRYPTION_KEY && process.env.DATA_ENCRYPTION_KEY.length < 32) {
        throw new Error("DATA_ENCRYPTION_KEY debe tener al menos 32 caracteres");
    }
    if (process.env.NODE_ENV === "production" && !String(process.env.CORS_ORIGIN || "").trim()) {
        throw new Error("CORS_ORIGIN es obligatoria en produccion");
    }
};
