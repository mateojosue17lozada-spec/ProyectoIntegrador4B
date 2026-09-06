/**
 * Tipos derivados de las respuestas reales del backend
 * (backend/src/modules/**). Si un campo es opcional aqui es porque el backend
 * puede devolverlo nulo, no por comodidad.
 */

export type Rol = "Administrador" | "Optometra" | "Cajero" | "Vendedor" | "Paciente";

export interface Usuario {
    id: number;
    nombre: string;
    apellido?: string | null;
    correo: string;
    usuario?: string;
    rol: Rol;
}

/** GET /auth/profile */
export interface Perfil extends Omit<Usuario, "id"> {
    id_usuario: number;
    cedula?: string | null;
    telefono?: string | null;
    fecha_nacimiento?: string | null;
    ultimo_login?: string | null;
    estado?: boolean;
    sesiones_activas?: number;
    actividad_reciente?: { accion: string; tabla_afectada: string; fecha: string }[];
}

export type EstadoCita =
    | "Pendiente"
    | "Confirmada"
    | "En atención"
    | "Atendida"
    | "Pagada"
    | "Cancelada";

/** GET /citas/mis-citas */
export interface Cita {
    id_cita: number;
    id_paciente: number;
    id_usuario: number;
    fecha_cita: string;
    hora_cita: string;
    motivo: string | null;
    estado: EstadoCita;
    pago_previo: boolean;
    consultorio: string | null;
    tarifa: number | string | null;
    profesional_nombre?: string;
    total_pagado?: number | string;
    motivo_cancelacion?: string | null;
}

/** GET /citas (vista profesional) */
export interface CitaAgenda extends Cita {
    paciente_nombre?: string;
}

export interface Profesional {
    id_usuario: number;
    nombre: string;
    apellido?: string | null;
    nombre_rol?: string;
}

/** GET /inventario/catalogo y /inventario/catalogo/:id */
export interface Producto {
    id_producto: number;
    nombre: string;
    descripcion: string | null;
    precio: number | string;
    stock: number;
    stock_minimo: number;
    codigo_barra: string | null;
    sku: string | null;
    tipo_lente: string | null;
    material: string | null;
    esfera: number | string | null;
    cilindro: number | string | null;
    eje: number | null;
    forma_montura: string | null;
    color_montura: string | null;
    imagen_data: string | null;
    /** Galería adicional (producto_imagenes), ordenada. Presente en el detalle. */
    imagenes?: { ruta: string; orden: number }[];
    categoria: string | null;
}

export interface LineaCarrito {
    producto: Producto;
    cantidad: number;
    opcion: string;
    /** Imagen compuesta del probador. Solo se guarda con consentimiento. */
    pruebaVirtual?: string | null;
}

/** POST /inventario/pedido */
export interface PedidoCreado {
    id_pedido: number;
    subtotal: number | string;
    impuestos: number | string;
    total: number | string;
    estado: string;
}

/** GET /facturacion/mis-pedidos: pedidos web del paciente con su detalle. */
export interface PedidoPendiente {
    id_pedido: number;
    subtotal: number | string;
    impuestos: number | string;
    total: number | string;
    estado: string; // PENDIENTE | COMPLETADO | CANCELADO
    observaciones: string | null;
    fecha_solicitud: string;
    detalles: {
        id_detalle: number | null;
        id_producto: number | null;
        nombre_producto: string | null;
        sku: string | null;
        cantidad: number;
        precio_unitario: number | string;
    }[];
}

/** GET /caja */
export interface TurnoCaja {
    id_caja_turno: number;
    id_cajero: number;
    fecha: string;
    monto_apertura: number | string;
    monto_cierre: number | string | null;
    ventas_efectivo?: number | string | null;
    efectivo_esperado?: number | string | null;
    diferencia?: number | string | null;
    estado: "Abierta" | "Cerrada";
    abierto_en: string;
    cerrado_en: string | null;
    observaciones?: string | null;
}

/** GET /dashboard */
export interface ResumenDashboard {
    pacientes: number;
    citas_hoy: number;
    citas_pagadas: number;
    citas_pendientes: number;
    stock_bajo: number;
    atenciones_hoy: number;
    ventas_hoy?: number;
}

/** Posicion de la montura sobre la foto, en porcentaje del contenedor. */
export interface AjusteMontura {
    anchoPct: number;
    topPct: number;
    leftPct: number;
    rotacion: number;
}
