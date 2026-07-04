const validarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        const rolUsuario = req.usuario.rol;

        if (!rolesPermitidos.includes(rolUsuario)) {
            return res.status(403).json({
                mensaje: "No tiene permisos para acceder a este modulo"
            });
        }

        next();
    };
};

module.exports = validarRol;
