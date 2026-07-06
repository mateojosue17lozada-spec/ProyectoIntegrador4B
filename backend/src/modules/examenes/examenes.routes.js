const express = require("express");
const auth = require("../../middleware/auth.middleware");
const rol = require("../../middleware/rol.middleware");
const controller = require("./examenes.controller");

const router = express.Router();
router.use(auth, rol(["Administrador", "Optometra"]));
router.get("/", controller.obtener);
router.post("/", controller.crear);
router.put("/:id", controller.actualizar);

module.exports = router;
