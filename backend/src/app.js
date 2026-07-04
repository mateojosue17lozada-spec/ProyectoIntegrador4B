require("dotenv").config();

const express = require("express");
const cors = require("cors");

const routes = require("./routes");

const app = express();

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

app.use(express.json());

app.use(routes);

module.exports = app;
