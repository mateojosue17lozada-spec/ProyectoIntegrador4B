require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const routes = require("./routes");
const errorMiddleware = require("./middleware/errorMiddleware");
const activityAudit = require("./middleware/activityAudit.middleware");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174")
    .split(",")
    .map((origin) => origin.trim());

// permitir comunicacion con React
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origen no permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
}));

app.use(express.json({ limit: "1mb" }));

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
