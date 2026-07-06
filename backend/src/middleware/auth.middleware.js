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
        return res.status(401).json({ mensaje: "Token invalido" });
    }
};
