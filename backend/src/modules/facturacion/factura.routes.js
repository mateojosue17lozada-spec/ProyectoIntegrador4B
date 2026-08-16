const e = require("express");
const auth = require("../../middleware/auth.middleware");
const rol = require("../../middleware/rol.middleware");
const responder = require("../../utils/http");
const s = require("./factura.service");
const r = e.Router();

r.use(auth);

// ─── Rutas accesibles por Pacientes (E-commerce) ────────────────────────────
// Confirmar un pedido web (crea el pedido pendiente)
r.post("/ecommerce/checkout", rol(["Paciente", "Administrador"]), responder(req => s.checkoutEcommerce(req.body, req.usuario, req), 201));

// Ver mis pedidos (Paciente ve los propios)
r.get("/mis-pedidos", rol(["Paciente"]), responder(async (req) => {
    const pool = require("../../config/database");
    // Obtener id_paciente vinculado al usuario
    const p = await pool.query("SELECT id_paciente FROM pacientes WHERE correo=$1", [req.usuario.correo]);
    if (!p.rows[0]) return [];
    return s.listarPedidosPaciente(p.rows[0].id_paciente);
}));

// ─── Rutas para Cajero / Administrador ──────────────────────────────────────
r.use(rol(["Administrador", "Cajero"]));

// Listar todos los pedidos pendientes para que el cajero pueda cobrarlos
r.get("/pedidos", responder(() => s.listarPedidos()));

// Confirmar (cobrar) un pedido: genera la factura real y descuenta stock
r.post("/pedidos/:id/confirmar", responder(req => s.confirmarPedido(req.params.id, req.body, req.usuario, req)));

// Cancelar un pedido
r.post("/pedidos/:id/cancelar", responder(req => s.cancelarPedido(req.params.id, req.usuario, req)));

// Facturas ya emitidas
r.get("/", responder(() => s.listar()));
r.get("/resumen-dia", responder(() => s.resumenDia()));
r.get("/promociones", responder(() => s.promociones()));
r.post("/promociones", rol(["Administrador"]), responder(req => s.crearPromocion(req.body), 201));
r.put("/promociones/:id", rol(["Administrador"]), responder(req => s.actualizarPromocion(req.params.id, req.body)));
r.delete("/promociones/:id", rol(["Administrador"]), responder(req => s.eliminarPromocion(req.params.id)));
r.get("/:id", responder(req => s.obtener(req.params.id)));
r.post("/", responder(req => s.crear(req.body, req.usuario, req), 201));
r.post("/:id/anular", rol(["Administrador"]), responder(req => s.anular(req.params.id, req.body, req.usuario, req)));
r.post("/:id/devoluciones", rol(["Administrador"]), responder(req => s.devolver(req.params.id, req.body, req.usuario, req), 201));

module.exports = r;
