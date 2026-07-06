const express = require("express");
const auth = require("../../middleware/auth.middleware");
const rol = require("../../middleware/rol.middleware");
const responder = require("../../utils/http");
const service = require("./historia.service");

const router = express.Router();
router.use(auth);
router.get("/", rol(["Administrador", "Optometra"]), responder((req) => service.listar(req.query.id_paciente)));
router.get("/cie10/catalogo", rol(["Administrador", "Optometra"]), responder((req) => service.cie10(req.query.buscar)));
router.get("/:id", rol(["Administrador", "Optometra", "Cajero"]), responder((req) => service.obtener(req.params.id)));
router.post("/", rol(["Administrador", "Optometra"]), responder((req) => service.crear(req.body, req.usuario, req), 201));
router.put("/:id", rol(["Administrador", "Optometra"]), responder((req) => service.actualizar(req.params.id, req.body, req.usuario, req)));
router.post("/:id/bloquear", rol(["Administrador", "Optometra"]), responder((req) => service.bloquear(req.params.id, req.usuario, req)));
module.exports = router;
