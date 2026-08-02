const jwt = require("jsonwebtoken");

const pool = require("../config/database");
const logger = require("../utils/logger");

const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

const logAuthReject = (req, motivo, detalle = {}) => {
    if (!AUTH_DEBUG) return;
    logger.warn("Solicitud autenticada rechazada", { eventCode: "AUTH_REJECTED", reason: motivo, method: req.method, path: req.originalUrl, ...detalle });
};

const parseCookies = (req) => {
    const list = {};
    const rc = req.headers.cookie;
    rc && rc.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
};

module.exports = async (req, res, next) => {
    const cookies = parseCookies(req);
    const tokenCookie = cookies.token;

    const authorization = req.headers.authorization || "";
    const tokenHeader = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    
    const token = tokenCookie || tokenHeader;

    if (!token) {
        logAuthReject(req, "Token ausente (ni en cookie ni en Authorization)", {
            authorizationRecibido: Boolean(authorization),
            cookieRecibida: Boolean(tokenCookie)
        });
        return res.status(401).json({ mensaje: "Token requerido" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(
            `SELECT u.id_usuario, u.nombre, u.correo, r.nombre_rol
             FROM sesiones_usuario s
             JOIN usuarios u ON u.id_usuario = s.id_usuario
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE s.id_sesion = $1 AND s.id_usuario = $2
               AND s.revocada_en IS NULL AND s.expira_en > NOW()
               AND u.estado = TRUE AND u.bloqueado = FALSE`,
            [decoded.jti, decoded.id]
        );

        if (result.rowCount === 0) {
            logAuthReject(req, "sesion no existe, expiro, fue revocada o usuario bloqueado", {
                usuarioId: decoded.id,
                exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
            });
            return res.status(401).json({ mensaje: "Sesion expirada o cerrada" });
        }

        const actual = result.rows[0];
        req.usuario = {
            ...decoded,
            id: actual.id_usuario,
            nombre: actual.nombre,
            correo: actual.correo,
            rol: actual.nombre_rol
        };
        return next();
    } catch (error) {
        logAuthReject(req, error.name || "jwt_verify_error", {
            errorType: error.name
        });
        return res.status(401).json({ mensaje: "Token invalido" });
    }
};
