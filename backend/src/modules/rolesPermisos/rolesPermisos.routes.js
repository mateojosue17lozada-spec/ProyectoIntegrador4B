const express = require("express");

const auth = require("../../middleware/auth.middleware");
const rol = require("../../middleware/rol.middleware");
const responder = require("../../utils/http");
const service = require("./rolesPermisos.service");

const router = express.Router();

router.use(auth, rol(["Administrador"]));
router.get("/", responder(() => service.listar()));

module.exports = router;
