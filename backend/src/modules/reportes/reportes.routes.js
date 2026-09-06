const express = require("express");
const auth = require("../../middleware/auth.middleware");
const rol = require("../../middleware/rol.middleware");
const responder = require("../../utils/http");
const service = require("./reportes.service");

const router = express.Router();
router.use(auth);

// Los reportes de gestion son para Administrador; el de cierre de caja tambien
// para Cajero (ve sus propios turnos).
router.get("/citas", rol(["Administrador", "Optometra"]), responder((req) => service.citas(req.query)));
router.get("/ventas", rol(["Administrador", "Cajero"]), responder((req) => service.ventas(req.query)));
router.get("/compras", rol(["Administrador"]), responder((req) => service.compras(req.query)));
router.get("/inventario", rol(["Administrador", "Vendedor"]), responder((req) => service.inventario(req.query)));
router.get("/cierre-caja", rol(["Administrador", "Cajero"]), responder((req) => service.cierreCaja(req.query)));

module.exports = router;
