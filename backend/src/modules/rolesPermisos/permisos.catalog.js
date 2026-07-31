const ROLES = ["Administrador", "Optometra", "Cajero", "Vendedor"];

const PERMISOS = [
    { modulo: "Dashboard", accion: "Ver resumen", roles: ROLES },
    { modulo: "Pacientes", accion: "Ver pacientes", roles: ROLES },
    { modulo: "Pacientes", accion: "Crear pacientes", roles: ["Administrador", "Optometra", "Vendedor"] },
    { modulo: "Pacientes", accion: "Actualizar pacientes", roles: ["Administrador", "Optometra"] },
    { modulo: "Pacientes", accion: "Eliminar pacientes", roles: ["Administrador"] },
    { modulo: "Citas", accion: "Ver citas", roles: ROLES },
    { modulo: "Citas", accion: "Crear citas", roles: ["Administrador", "Cajero", "Vendedor"] },
    { modulo: "Citas", accion: "Actualizar estado", roles: ROLES },
    { modulo: "Citas", accion: "Registrar pago previo", roles: ["Administrador", "Cajero"] },
    { modulo: "Citas", accion: "Cancelar citas", roles: ["Administrador"] },
    { modulo: "Examen visual", accion: "Gestionar examenes", roles: ["Administrador", "Optometra"] },
    { modulo: "Historia clinica", accion: "Ver historias", roles: ["Administrador", "Optometra"] },
    { modulo: "Historia clinica", accion: "Ver detalle", roles: ["Administrador", "Optometra", "Cajero"] },
    { modulo: "Historia clinica", accion: "Crear y actualizar historias", roles: ["Administrador", "Optometra"] },
    { modulo: "Recetas", accion: "Ver recetas y pedidos", roles: ["Administrador", "Optometra", "Vendedor"] },
    { modulo: "Recetas", accion: "Crear recetas", roles: ["Administrador", "Optometra"] },
    { modulo: "Recetas", accion: "Gestionar laboratorios", roles: ["Administrador"] },
    { modulo: "Recetas", accion: "Actualizar pedidos", roles: ["Administrador", "Vendedor"] },
    { modulo: "Inventario", accion: "Ver inventario", roles: ["Administrador", "Cajero", "Vendedor"] },
    { modulo: "Inventario", accion: "Gestionar productos, categorias y ajustes", roles: ["Administrador"] },
    { modulo: "Compras", accion: "Gestionar compras y proveedores", roles: ["Administrador"] },
    { modulo: "Facturacion", accion: "Ver y emitir facturas", roles: ["Administrador", "Cajero"] },
    { modulo: "Facturacion", accion: "Gestionar promociones, anulaciones y devoluciones", roles: ["Administrador"] },
    { modulo: "Caja", accion: "Gestionar caja", roles: ["Administrador", "Cajero"] },
    { modulo: "Cartera", accion: "Ver y cobrar cuentas por cobrar", roles: ["Administrador", "Cajero"] },
    { modulo: "Cartera", accion: "Gestionar cuentas por pagar", roles: ["Administrador"] },
    { modulo: "Usuarios", accion: "Gestionar usuarios, roles y auditoria", roles: ["Administrador"] },
    { modulo: "Roles y permisos", accion: "Ver matriz de permisos", roles: ["Administrador"] }
];

module.exports = { ROLES, PERMISOS };
