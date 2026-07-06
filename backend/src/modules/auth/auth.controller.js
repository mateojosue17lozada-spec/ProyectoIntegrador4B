const service = require("./auth.service");

exports.login = async (req, res) => {
    try {
        const resultado = await service.login({
            identificador: req.body.identificador,
            correo: req.body.correo,
            usuario: req.body.usuario,
            password: req.body.password,
            req
        });

        res.json(resultado);
    } catch (error) {
        console.log(error.message);
        res.status(error.status || 400).json({ mensaje: error.message });
    }
};

exports.register = async (req, res) => {
    try {
        const usuario = await service.register(req.body, req);

        res.json({
            mensaje: "Usuario creado correctamente",
            usuario
        });
    } catch (error) {
        console.log(error.message);
        res.status(error.status || 400).json({ mensaje: error.message });
    }
};

exports.solicitarRecuperacion = async (req, res) => {
    try {
        const resultado = await service.solicitarRecuperacion({
            identificador: req.body.identificador,
            correo: req.body.correo,
            req
        });

        res.json(resultado);
    } catch (error) {
        console.log(error.message);
        res.status(error.status || 400).json({ mensaje: error.message });
    }
};

exports.restablecerPassword = async (req, res) => {
    try {
        const resultado = await service.restablecerPassword({
            token: req.body.token,
            password: req.body.password,
            req
        });

        res.json(resultado);
    } catch (error) {
        console.log(error.message);
        res.status(error.status || 400).json({ mensaje: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        const resultado = await service.logout({
            jti: req.usuario.jti,
            idUsuario: req.usuario.id,
            req
        });
        res.json(resultado);
    } catch (error) {
        res.status(error.status || 400).json({ mensaje: error.message });
    }
};
