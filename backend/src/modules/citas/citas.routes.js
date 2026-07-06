// backend/src/modules/citas/citas.routes.js

const express = require("express");

const router = express.Router();


const auth = require("../../middleware/auth.middleware");

const controller = require("./citas.controller");
const responder = require("../../utils/http");
const service = require("./citas.service");
const rol = require("../../middleware/rol.middleware");



// Obtener citas
router.get(
"/",
auth,
rol(["Administrador","Optometra","Cajero","Vendedor"]),
controller.obtener
);



// Crear cita
router.post(
"/",
auth,
rol(["Administrador","Cajero","Vendedor"]),
controller.crear
);

router.patch("/:id", auth, rol(["Administrador","Optometra","Cajero","Vendedor"]), responder((req) => service.actualizarEstado(req.params.id, req.body, req.usuario, req)));
router.post("/:id/pago-previo", auth, rol(["Administrador","Cajero"]), responder((req) => service.registrarPagoPrevio(req.params.id, req.body, req.usuario, req), 201));
router.delete("/:id",auth,rol(["Administrador"]),responder((req)=>service.cancelar(req.params.id,req.usuario,req)));



module.exports = router;
