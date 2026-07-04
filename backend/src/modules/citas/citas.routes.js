// backend/src/modules/citas/citas.routes.js

const express = require("express");

const router = express.Router();


const auth = require("../../middleware/auth.middleware");

const controller = require("./citas.controller");
const responder = require("../../utils/http");
const service = require("./citas.service");



// Obtener citas
router.get(
"/",
auth,
controller.obtener
);



// Crear cita
router.post(
"/",
auth,
controller.crear
);

router.patch("/:id", auth, responder((req) => service.actualizarEstado(req.params.id, req.body)));
router.post("/:id/pago-previo", auth, responder((req) => service.registrarPagoPrevio(req.params.id, req.body, req.usuario), 201));
router.delete("/:id",auth,controller.eliminar);



module.exports = router;
