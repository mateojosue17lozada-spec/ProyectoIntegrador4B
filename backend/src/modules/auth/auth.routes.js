// backend/src/modules/auth/auth.routes.js

const express = require("express");

const router = express.Router();

const controller = require("./auth.controller");
const auth = require("../../middleware/auth.middleware");
const validarRol = require("../../middleware/rol.middleware");



// LOGIN

router.post(
"/login",
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
controller.solicitarRecuperacion
);

router.post(
"/reset-password",
controller.restablecerPassword
);

router.post("/logout", auth, controller.logout);



module.exports = router;
