const service = require("./auth.service");
const logger = require("../../utils/logger");

exports.login = async (req, res) => {
    try {
        const resultado = await service.login({
            identificador: req.body.identificador,
            correo: req.body.correo,
            usuario: req.body.usuario,
            password: req.body.password,
            req
        });

        // Configurar cookie HttpOnly
        res.cookie("token", resultado.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 8 * 60 * 60 * 1000 // 8 horas
        });

        const { token, ...respuestaJSON } = resultado;
        res.json(respuestaJSON);
    } catch (error) {
        logger.warn("Inicio de sesion rechazado", { eventCode: "LOGIN_REJECTED", reason: error.internalCode || "INVALID_CREDENTIALS" });
        
        if (error.internalCode === "LOGIN_BLOCKED") {
            return res.status(403).json({ mensaje: "Tu cuenta ha sido bloqueada temporalmente por múltiples intentos fallidos. Por favor, intenta más tarde o contacta al administrador." });
        }

        res.status(401).json({ mensaje: "Usuario o contraseña incorrectos." });
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
        logger.warn("Registro de usuario rechazado", { eventCode: "USER_REGISTRATION_REJECTED", reason: error.name });
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
        logger.warn("Solicitud de recuperacion rechazada", { eventCode: "PASSWORD_RESET_REQUEST_REJECTED", reason: error.internalCode || error.name });
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
        logger.warn("Restablecimiento rechazado", { eventCode: "PASSWORD_RESET_REJECTED", reason: error.internalCode || error.name });
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
        res.clearCookie("token");
        res.json(resultado);
    } catch (error) {
        res.status(error.status || 400).json({ mensaje: error.message });
    }
};

exports.validarToken = async (req,res) => {
    try { res.json(await service.validarTokenRecuperacion(req.query.token)); }
    catch (error) { res.status(error.status || 400).json({ mensaje:error.message }); }
};
exports.perfil = async (req,res) => {
    try { res.json(await service.perfil(req.usuario.id)); }
    catch (error) { res.status(error.status || 400).json({ mensaje:error.message }); }
};
exports.actualizarPerfil = async (req,res) => {
    try { res.json(await service.actualizarPerfil(req.usuario.id,req.body,req)); }
    catch (error) { res.status(error.status || 400).json({ mensaje:error.message }); }
};
