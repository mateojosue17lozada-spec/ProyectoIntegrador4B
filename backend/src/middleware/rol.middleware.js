const { validarPermiso } = require("../utils/permisos");

const requerirPermiso = (permisoORoles) => {
    return (req, res, next) => {
        const rolUsuario = req.usuario.rol;

        if (Array.isArray(permisoORoles)) {
            if (!permisoORoles.includes(rolUsuario)) {
                return res.status(403).json({
                    mensaje: "No tiene permisos para acceder a este modulo"
                });
            }
        } else {
            if (!validarPermiso(rolUsuario, permisoORoles)) {
                return res.status(403).json({
                    mensaje: "No tiene permisos para acceder a este modulo"
                });
            }
        }

        next();
    };
};

module.exports = requerirPermiso;
