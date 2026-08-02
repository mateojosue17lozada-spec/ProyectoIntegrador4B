const PERMISOS = {
    // USUARIOS Y SEGURIDAD
    CREAR_USUARIO: ["Administrador"],
    EDITAR_USUARIO: ["Administrador"],
    VER_USUARIOS: ["Administrador"],
    VER_AUDITORIA: ["Administrador"],

    // CLINICA
    CREAR_HISTORIA: ["Administrador", "Optometra"],
    EDITAR_HISTORIA: ["Administrador", "Optometra"],
    VER_HISTORIA: ["Administrador", "Optometra"],
    CREAR_CITA: ["Administrador", "Vendedor", "Optometra", "Cajero"],
    VER_CITAS: ["Administrador", "Vendedor", "Optometra", "Cajero"],

    // CAJA Y FINANZAS
    ABRIR_CAJA: ["Administrador", "Cajero"],
    CERRAR_CAJA: ["Administrador", "Cajero"],
    FACTURAR: ["Administrador", "Cajero", "Vendedor"],
    VER_FACTURAS: ["Administrador", "Cajero", "Vendedor"],
    APLICAR_DESCUENTO: ["Administrador"],

    // INVENTARIO Y COMPRAS
    AJUSTAR_INVENTARIO: ["Administrador"],
    VER_INVENTARIO: ["Administrador", "Cajero", "Vendedor", "Optometra"],
    CREAR_COMPRA: ["Administrador"]
};

const validarPermiso = (rol, permiso) => {
    if (!PERMISOS[permiso]) return false;
    return PERMISOS[permiso].includes(rol);
};

module.exports = {
    PERMISOS,
    validarPermiso
};
