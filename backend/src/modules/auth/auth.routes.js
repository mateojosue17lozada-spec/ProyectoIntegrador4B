// backend/src/modules/auth/auth.routes.js

const express = require("express");

const router = express.Router();

const controller = require("./auth.controller");
const auth = require("../../middleware/auth.middleware");
const validarRol = require("../../middleware/rol.middleware");
const { rateLimit } = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { mensaje: "Demasiados intentos. Espere 15 minutos" }
});



// LOGIN

router.post(
"/login",
authLimiter,
controller.login
);



// REGISTRO

router.post(
"/register",
auth,
validarRol(["Administrador"]),
controller.register
);

router.post(
"/forgot-password",
authLimiter,
controller.solicitarRecuperacion
);

router.post(
"/reset-password",
authLimiter,
controller.restablecerPassword
);

router.post("/logout", auth, controller.logout);
router.get("/me", auth, (req, res) => res.json({ usuario: req.usuario }));



module.exports = router;
