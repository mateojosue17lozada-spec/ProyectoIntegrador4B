require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const routes = require("./routes");
const errorMiddleware = require("./middleware/errorMiddleware");
const activityAudit = require("./middleware/activityAudit.middleware");
const { checkSchema } = require("./config/schemaCheck");

const app = express();

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", async (req, res) => {
    try {
        const result = await checkSchema();
        return result.ready
            ? res.status(200).json({ status: "ready" })
            : res.status(503).json({ status: "unavailable" });
    } catch {
        return res.status(503).json({ status: "unavailable" });
    }
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const configuredOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174")
    .split(",")
    .map((origin) => origin.trim());
const expoDevOrigins = process.env.NODE_ENV === "production" ? [] : [
    "http://localhost:8081",
    "http://localhost:19006",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:19006"
];
const allowedOrigins = [...new Set([...configuredOrigins, ...expoDevOrigins])];

// permitir comunicacion con React y React Native
app.use(cors({
    origin: (origin, callback) => {
        // React Native fetch no envia header Origin → origin es undefined
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // En desarrollo, permitir IPs de red local (192.168.x.x, 10.x.x.x)
        if (process.env.NODE_ENV !== "production" && origin && /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origen no permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
}));

app.use(express.json({ limit: "3mb" }));

app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { mensaje: "Demasiadas solicitudes. Intente nuevamente en unos minutos" }
}));
app.use("/api", activityAudit);

app.use(routes);
app.use((req, res) => res.status(404).json({ mensaje: "Ruta no encontrada" }));
app.use(errorMiddleware);

module.exports = app;
