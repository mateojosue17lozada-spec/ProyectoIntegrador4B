const express = require("express");

const router = express.Router();


const authRoutes = require("./modules/auth/auth.routes");
const usuariosRoutes = require("./modules/usuarios/usuarios.routes");
const pacientesRoutes = require("./modules/pacientes/pacientes.routes");
const citasRoutes = require("./modules/citas/citas.routes");
const examenesRoutes = require("./modules/examenes/examenes.routes");

const historiaRoutes = require("./modules/historiaClinica/historia.routes");

const inventarioRoutes = require("./modules/inventario/inventario.routes");

const facturaRoutes = require("./modules/facturacion/factura.routes");

const cajaRoutes = require("./modules/caja/caja.routes");

const carteraRoutes = require("./modules/cartera/cartera.routes");
const recetasRoutes = require("./modules/recetas/recetas.routes");

const comprasRoutes = require("./modules/compras/compras.routes");



// rutas principales

router.use("/api/auth", authRoutes);

router.use("/api/usuarios", usuariosRoutes);

router.use("/api/pacientes", pacientesRoutes);

router.use("/api/citas", citasRoutes);
router.use("/api/examenes", examenesRoutes);

router.use("/api/historia", historiaRoutes);

router.use("/api/inventario", inventarioRoutes);

router.use("/api/facturacion", facturaRoutes);

router.use("/api/caja", cajaRoutes);

router.use("/api/cartera", carteraRoutes);
router.use("/api/recetas", recetasRoutes);

router.use("/api/compras", comprasRoutes);


module.exports = router;
