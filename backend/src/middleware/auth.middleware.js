const jwt = require("jsonwebtoken");

const pool = require("../config/database");

module.exports = async (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

    if (!token) {
        return res.status(401).json({ mensaje: "Token requerido" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(
            `SELECT 1 FROM sesiones_usuario
             WHERE id_sesion = $1 AND id_usuario = $2
               AND revocada_en IS NULL AND expira_en > NOW()`,
            [decoded.jti, decoded.id]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ mensaje: "Sesion expirada o cerrada" });
        }

        req.usuario = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({ mensaje: "Token invalido" });
    }
};
