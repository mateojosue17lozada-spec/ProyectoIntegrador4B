// backend/src/modules/examenes/examenes.routes.js


const express = require("express");

const router = express.Router();


const auth = require("../../middleware/auth.middleware");

const controller = require("./examenes.controller");





router.get(

"/",

auth,

controller.obtener

);






router.post(

"/",

auth,

controller.crear

);







router.put(

"/:id",

auth,

controller.actualizar

);







router.delete(

"/:id",

auth,

controller.eliminar

);





module.exports = router;