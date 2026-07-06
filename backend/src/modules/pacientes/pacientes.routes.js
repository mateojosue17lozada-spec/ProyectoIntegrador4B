// backend/src/modules/pacientes/pacientes.routes.js

const express = require("express");

const router = express.Router();


const auth = require("../../middleware/auth.middleware");

const controller = require("./pacientes.controller");
const rol = require("../../middleware/rol.middleware");



router.get(
"/",
auth,
rol(["Administrador", "Optometra", "Cajero", "Vendedor"]),
controller.obtener
);



router.post(
"/",
auth,
rol(["Administrador", "Optometra", "Vendedor"]),
controller.crear
);



router.put(
"/:id",
auth,
rol(["Administrador", "Optometra"]),
controller.actualizar
);



// ELIMINAR PACIENTE

router.delete(
"/:id",
auth,
rol(["Administrador"]),
controller.eliminar
);



module.exports = router;
