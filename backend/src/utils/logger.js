const SENSITIVE_KEYS = /password|contrasena|token|accesstoken|refreshtoken|authorization|cookie|secret|jwt|resettoken/i;

const redact = (value, seen = new WeakSet()) => {
    if (value === null || value === undefined || typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => redact(item, seen));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redact(item, seen)
    ]));
};

const write = (level, message, context = {}) => {
    const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...redact(context)
    });
    const output = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    output(entry);
};

module.exports = {
    redact,
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context)
};
