const audit = require("../utils/audit");

module.exports = (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    res.on("finish", () => {
        if (res.statusCode < 400 && req.usuario?.id) {
            audit({
                idUsuario: req.usuario.id,
                accion: `HTTP_${req.method}`,
                tabla: req.originalUrl.split("?")[0].split("/")[2] || "api",
                detalle: { ruta: req.originalUrl, estado: res.statusCode },
                req
            });
        }
    });
    next();
};
