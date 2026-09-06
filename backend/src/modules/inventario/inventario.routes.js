const express = require("express");
const auth = require("../../middleware/auth.middleware");
const rol = require("../../middleware/rol.middleware");
const responder = require("../../utils/http");
const service = require("./inventario.service");
const router = express.Router();

// Rutas públicas o sin autenticación (si las hay) - en este caso no hay

// Middleware de autenticación para todas las rutas siguientes
router.use(auth);

// Rutas para administración de inventario (requieren roles específicos)
router.get("/", rol(["Administrador", "Optometra", "Cajero", "Vendedor"]), responder(req => service.listar(req.query)));
router.get("/categorias", rol(["Administrador", "Cajero", "Vendedor"]), responder(() => service.categorias()));
router.post("/categorias", rol(["Administrador"]), responder(req => service.crearCategoria(req.body), 201));
router.put("/categorias/:id", rol(["Administrador"]), responder(req => service.actualizarCategoria(req.params.id, req.body)));
router.delete("/categorias/:id", rol(["Administrador"]), responder(req => service.eliminarCategoria(req.params.id)));
router.get("/ajustes", rol(["Administrador"]), responder(() => service.ajustes()));
router.post("/", rol(["Administrador"]), responder(req => service.crear(req.body, req.usuario, req), 201));
router.put("/:id", rol(["Administrador"]), responder(req => service.actualizar(req.params.id, req.body, req.usuario, req)));
router.delete("/:id", rol(["Administrador"]), responder(req => service.desactivar(req.params.id, req.usuario, req)));
router.post("/ajustes", rol(["Administrador"]), responder(req => service.ajustar(req.body, req.usuario, req), 201));

// Rutas para catálogo (cualquier usuario autenticado, sin restricción de rol específico)
router.get("/catalogo", responder(req => service.listarCatalogo(req.query)));
router.get("/catalogo/:id", responder(req => service.detalleCatalogo(req.params.id)));

// Rutas para pedidos (paciente y admin/cajero)
router.post("/pedido", rol(["Paciente"]), responder(req => service.crearPedidoPendiente(req.body, req.usuario, req), 201));
router.get("/pedidos", rol(["Administrador", "Cajero"]), responder(req => service.listarPedidosPendientes(req.query)));
router.get("/pedido/:id/prueba/:idProducto", rol(["Administrador", "Cajero", "Optometra"]), responder(req => service.pruebaVirtualPedido(req.params.id, req.params.idProducto)));
router.post("/pedido/:id/convertir", rol(["Administrador", "Cajero"]), responder(req => service.convertirPedidoAFactura(req.params.id, req.usuario, req)));

module.exports = router;