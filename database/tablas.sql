-- Esquema base para sistema optico/clinico.
-- Ejecutar en PostgreSQL. Mantiene nombres usados por el backend actual.

CREATE TABLE IF NOT EXISTS roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) UNIQUE NOT NULL CHECK (nombre_rol IN ('Administrador','Optometra','Cajero','Vendedor')),
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    correo VARCHAR(150) UNIQUE NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    cedula VARCHAR(20) UNIQUE,
    telefono VARCHAR(30),
    id_rol INTEGER REFERENCES roles(id_rol),
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_nacimiento DATE,
    ultimo_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria (
    id_auditoria BIGSERIAL PRIMARY KEY,
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(100),
    id_registro INTEGER,
    detalle JSONB,
    ip VARCHAR(80),
    user_agent TEXT,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recuperacion_password (
    id_recuperacion BIGSERIAL PRIMARY KEY,
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    token VARCHAR(255),
    expiracion TIMESTAMP,
    usado BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS pacientes (
    id_paciente SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    cedula VARCHAR(20) UNIQUE,
    telefono VARCHAR(20),
    correo VARCHAR(150),
    direccion TEXT,
    fecha_nacimiento DATE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS citas (
    id_cita SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL REFERENCES pacientes(id_paciente),
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    fecha_cita DATE NOT NULL,
    hora_cita TIME NOT NULL,
    motivo VARCHAR(255),
    estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
    observacion TEXT,
    pago_previo BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagos_previos (
    id_pago_previo SERIAL PRIMARY KEY,
    id_cita INTEGER NOT NULL REFERENCES citas(id_cita),
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    monto NUMERIC(10,2) NOT NULL CHECK (monto >= 0),
    forma_pago VARCHAR(30) NOT NULL CHECK (forma_pago IN ('Efectivo','Tarjeta','Transferencia','Credito','Mixto')),
    referencia VARCHAR(100),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historias_clinicas (
    id_historia SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL REFERENCES pacientes(id_paciente),
    id_cita INTEGER REFERENCES citas(id_cita),
    id_optometra INTEGER REFERENCES usuarios(id_usuario),
    motivo TEXT,
    antecedentes_personales TEXT,
    antecedentes_familiares TEXT,
    antecedentes_oculares TEXT,
    lensometria JSONB,
    agudeza_visual JSONB,
    examen_externo TEXT,
    reflejos_pupilares TEXT,
    oftalmoscopia TEXT,
    diagnostico_cie10 VARCHAR(20),
    diagnostico_descripcion TEXT,
    examen_motor TEXT,
    observaciones_patologicas TEXT,
    tratamiento TEXT,
    datos_encriptados TEXT,
    bloqueada BOOLEAN NOT NULL DEFAULT FALSE,
    editable_hasta TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS examen_visual (
    id_examen SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL REFERENCES pacientes(id_paciente),
    id_cita INTEGER REFERENCES citas(id_cita),
    ojo_derecho VARCHAR(80),
    ojo_izquierdo VARCHAR(80),
    diagnostico TEXT,
    observacion TEXT,
    fecha_examen TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recetas (
    id_receta SERIAL PRIMARY KEY,
    id_historia INTEGER REFERENCES historias_clinicas(id_historia),
    id_paciente INTEGER NOT NULL REFERENCES pacientes(id_paciente),
    id_optometra INTEGER REFERENCES usuarios(id_usuario),
    od_esfera NUMERIC(5,2),
    od_cilindro NUMERIC(5,2),
    od_eje INTEGER,
    oi_esfera NUMERIC(5,2),
    oi_cilindro NUMERIC(5,2),
    oi_eje INTEGER,
    adicion NUMERIC(5,2),
    observaciones TEXT,
    impresa BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratorios (
    id_laboratorio SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(30),
    correo VARCHAR(150),
    direccion TEXT
);

CREATE TABLE IF NOT EXISTS pedidos_laboratorio (
    id_pedido_laboratorio SERIAL PRIMARY KEY,
    id_receta INTEGER REFERENCES recetas(id_receta),
    id_laboratorio INTEGER REFERENCES laboratorios(id_laboratorio),
    descripcion TEXT,
    estado VARCHAR(40) NOT NULL DEFAULT 'Enviado'
        CHECK (estado IN ('Enviado','Recibido','En proceso','Listo','Entregado','Cancelado')),
    impreso BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_envio TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_entrega TIMESTAMP,
    estado_ensamblaje VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
);

CREATE TABLE IF NOT EXISTS categorias_producto (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS productos (
    id_producto SERIAL PRIMARY KEY,
    id_categoria INTEGER REFERENCES categorias_producto(id_categoria),
    codigo_barra VARCHAR(100) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    material VARCHAR(80),
    esfera NUMERIC(5,2),
    cilindro NUMERIC(5,2),
    eje INTEGER,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    costo NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
    precio NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ajustes_inventario (
    id_ajuste SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto),
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('Merma','Rotura','Inventario fisico','Correccion')),
    cantidad INTEGER NOT NULL,
    motivo TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    ruc VARCHAR(20) UNIQUE,
    telefono VARCHAR(30),
    correo VARCHAR(150),
    direccion TEXT,
    condiciones_credito TEXT,
    dias_credito INTEGER NOT NULL DEFAULT 0 CHECK (dias_credito >= 0)
);

CREATE TABLE IF NOT EXISTS ordenes_compra (
    id_orden_compra SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id_proveedor),
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente','Aprobada','Recibida','Cancelada')),
    total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    fecha_orden TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orden_compra_detalle (
    id_detalle SERIAL PRIMARY KEY,
    id_orden_compra INTEGER NOT NULL REFERENCES ordenes_compra(id_orden_compra),
    id_producto INTEGER REFERENCES productos(id_producto),
    descripcion VARCHAR(180) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(10,2) NOT NULL CHECK (costo_unitario >= 0)
);

CREATE TABLE IF NOT EXISTS recepciones_compra (
    id_recepcion SERIAL PRIMARY KEY,
    id_orden_compra INTEGER REFERENCES ordenes_compra(id_orden_compra),
    factura_proveedor VARCHAR(100),
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caja_turnos (
    id_caja_turno SERIAL PRIMARY KEY,
    id_cajero INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    monto_apertura NUMERIC(10,2) NOT NULL DEFAULT 0,
    monto_cierre NUMERIC(10,2),
    estado VARCHAR(20) NOT NULL DEFAULT 'Abierta' CHECK (estado IN ('Abierta','Cerrada')),
    abierto_en TIMESTAMP NOT NULL DEFAULT NOW(),
    cerrado_en TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facturas (
    id_factura SERIAL PRIMARY KEY,
    id_paciente INTEGER REFERENCES pacientes(id_paciente),
    id_receta INTEGER REFERENCES recetas(id_receta),
    id_historia INTEGER REFERENCES historias_clinicas(id_historia),
    id_caja_turno INTEGER REFERENCES caja_turnos(id_caja_turno),
    numero_factura VARCHAR(50) UNIQUE,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    descuento NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'Emitida'
        CHECK (estado IN ('Emitida','Anulada','Devuelta','Nota credito')),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factura_detalle (
    id_detalle SERIAL PRIMARY KEY,
    id_factura INTEGER NOT NULL REFERENCES facturas(id_factura),
    id_producto INTEGER REFERENCES productos(id_producto),
    descripcion VARCHAR(180) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS factura_pagos (
    id_pago SERIAL PRIMARY KEY,
    id_factura INTEGER NOT NULL REFERENCES facturas(id_factura),
    forma_pago VARCHAR(30) NOT NULL CHECK (forma_pago IN ('Efectivo','Tarjeta','Transferencia','Credito','Mixto')),
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    referencia VARCHAR(100),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notas_credito (
    id_nota_credito SERIAL PRIMARY KEY,
    id_factura INTEGER NOT NULL REFERENCES facturas(id_factura),
    motivo TEXT NOT NULL,
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promociones (
    id_promocion SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
    requiere_permiso BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
    id_cxc SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL REFERENCES pacientes(id_paciente),
    id_factura INTEGER REFERENCES facturas(id_factura),
    saldo NUMERIC(10,2) NOT NULL CHECK (saldo >= 0),
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Pagada','Vencida')),
    credito_bloqueado BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS abonos_cxc (
    id_abono SERIAL PRIMARY KEY,
    id_cxc INTEGER NOT NULL REFERENCES cuentas_por_cobrar(id_cxc),
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    forma_pago VARCHAR(30) NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
    id_cxp SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id_proveedor),
    id_orden_compra INTEGER REFERENCES ordenes_compra(id_orden_compra),
    saldo NUMERIC(10,2) NOT NULL CHECK (saldo >= 0),
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Pagada','Vencida'))
);

CREATE TABLE IF NOT EXISTS sesiones_usuario (
    id_sesion UUID PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    expira_en TIMESTAMP NOT NULL,
    revocada_en TIMESTAMP,
    creada_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recepcion_compra_detalle (
    id_detalle SERIAL PRIMARY KEY,
    id_recepcion INTEGER NOT NULL REFERENCES recepciones_compra(id_recepcion),
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(10,2) NOT NULL CHECK (costo_unitario >= 0)
);

CREATE TABLE IF NOT EXISTS devoluciones (
    id_devolucion SERIAL PRIMARY KEY,
    id_factura INTEGER NOT NULL REFERENCES facturas(id_factura),
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    motivo TEXT NOT NULL,
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    creada_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS abonos_cxp (
    id_abono SERIAL PRIMARY KEY,
    id_cxp INTEGER NOT NULL REFERENCES cuentas_por_pagar(id_cxp),
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION impedir_edicion_historia_bloqueada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF OLD.bloqueada OR NOW() > OLD.editable_hasta THEN
        RAISE EXCEPTION 'La historia clinica esta bloqueada y no puede modificarse';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS historias_bloqueo_legal ON historias_clinicas;
CREATE TRIGGER historias_bloqueo_legal
BEFORE UPDATE ON historias_clinicas
FOR EACH ROW EXECUTE FUNCTION impedir_edicion_historia_bloqueada();

CREATE INDEX IF NOT EXISTS usuarios_correo_idx ON usuarios (lower(correo));
CREATE INDEX IF NOT EXISTS usuarios_usuario_idx ON usuarios (lower(usuario));
CREATE INDEX IF NOT EXISTS recuperacion_password_token_activo_idx ON recuperacion_password (token) WHERE usado = FALSE;
CREATE INDEX IF NOT EXISTS auditoria_usuario_fecha_idx ON auditoria (id_usuario, fecha DESC);
CREATE INDEX IF NOT EXISTS pacientes_cedula_idx ON pacientes (cedula);
CREATE INDEX IF NOT EXISTS citas_paciente_idx ON citas (id_paciente);
CREATE INDEX IF NOT EXISTS citas_fecha_estado_idx ON citas (fecha_cita, estado);
CREATE INDEX IF NOT EXISTS examen_visual_paciente_idx ON examen_visual (id_paciente);
CREATE INDEX IF NOT EXISTS historias_paciente_idx ON historias_clinicas (id_paciente);
CREATE INDEX IF NOT EXISTS recetas_historia_idx ON recetas (id_historia);
CREATE INDEX IF NOT EXISTS productos_codigo_idx ON productos (codigo_barra) WHERE codigo_barra IS NOT NULL;
CREATE INDEX IF NOT EXISTS productos_stock_minimo_idx ON productos (stock) WHERE stock <= stock_minimo;
CREATE INDEX IF NOT EXISTS facturas_paciente_idx ON facturas (id_paciente);
CREATE INDEX IF NOT EXISTS cxc_vencimiento_idx ON cuentas_por_cobrar (fecha_vencimiento, estado);
CREATE INDEX IF NOT EXISTS cxp_vencimiento_idx ON cuentas_por_pagar (fecha_vencimiento, estado);
CREATE INDEX IF NOT EXISTS sesiones_usuario_activa_idx ON sesiones_usuario (id_usuario, expira_en) WHERE revocada_en IS NULL;
CREATE INDEX IF NOT EXISTS pagos_previos_cita_idx ON pagos_previos (id_cita);
CREATE INDEX IF NOT EXISTS pedidos_laboratorio_estado_idx ON pedidos_laboratorio (estado, estado_ensamblaje);
CREATE INDEX IF NOT EXISTS ordenes_compra_proveedor_idx ON ordenes_compra (id_proveedor, fecha_orden DESC);
CREATE INDEX IF NOT EXISTS factura_pagos_factura_idx ON factura_pagos (id_factura);
CREATE INDEX IF NOT EXISTS abonos_cxc_cuenta_idx ON abonos_cxc (id_cxc);
CREATE INDEX IF NOT EXISTS recepcion_detalle_recepcion_idx ON recepcion_compra_detalle (id_recepcion);
CREATE INDEX IF NOT EXISTS abonos_cxp_cuenta_idx ON abonos_cxp (id_cxp);
CREATE INDEX IF NOT EXISTS usuarios_rol_idx ON usuarios (id_rol);
CREATE INDEX IF NOT EXISTS recuperacion_password_usuario_idx ON recuperacion_password (id_usuario);
CREATE INDEX IF NOT EXISTS citas_usuario_idx ON citas (id_usuario);
CREATE INDEX IF NOT EXISTS pagos_previos_usuario_idx ON pagos_previos (id_usuario);
CREATE INDEX IF NOT EXISTS historias_cita_idx ON historias_clinicas (id_cita);
CREATE INDEX IF NOT EXISTS historias_optometra_idx ON historias_clinicas (id_optometra);
CREATE INDEX IF NOT EXISTS examen_visual_cita_idx ON examen_visual (id_cita);
CREATE INDEX IF NOT EXISTS recetas_paciente_idx ON recetas (id_paciente);
CREATE INDEX IF NOT EXISTS recetas_optometra_idx ON recetas (id_optometra);
CREATE INDEX IF NOT EXISTS pedidos_laboratorio_receta_idx ON pedidos_laboratorio (id_receta);
CREATE INDEX IF NOT EXISTS pedidos_laboratorio_laboratorio_idx ON pedidos_laboratorio (id_laboratorio);
CREATE INDEX IF NOT EXISTS productos_categoria_idx ON productos (id_categoria);
CREATE INDEX IF NOT EXISTS ajustes_inventario_producto_idx ON ajustes_inventario (id_producto);
CREATE INDEX IF NOT EXISTS ajustes_inventario_usuario_idx ON ajustes_inventario (id_usuario);
CREATE INDEX IF NOT EXISTS ordenes_compra_usuario_idx ON ordenes_compra (id_usuario);
CREATE INDEX IF NOT EXISTS orden_compra_detalle_orden_idx ON orden_compra_detalle (id_orden_compra);
CREATE INDEX IF NOT EXISTS orden_compra_detalle_producto_idx ON orden_compra_detalle (id_producto);
CREATE INDEX IF NOT EXISTS recepciones_compra_orden_idx ON recepciones_compra (id_orden_compra);
CREATE INDEX IF NOT EXISTS recepciones_compra_usuario_idx ON recepciones_compra (id_usuario);
CREATE INDEX IF NOT EXISTS recepcion_detalle_producto_idx ON recepcion_compra_detalle (id_producto);
CREATE INDEX IF NOT EXISTS caja_turnos_cajero_idx ON caja_turnos (id_cajero);
CREATE INDEX IF NOT EXISTS facturas_receta_idx ON facturas (id_receta);
CREATE INDEX IF NOT EXISTS facturas_historia_idx ON facturas (id_historia);
CREATE INDEX IF NOT EXISTS facturas_caja_idx ON facturas (id_caja_turno);
CREATE INDEX IF NOT EXISTS factura_detalle_factura_idx ON factura_detalle (id_factura);
CREATE INDEX IF NOT EXISTS factura_detalle_producto_idx ON factura_detalle (id_producto);
CREATE INDEX IF NOT EXISTS notas_credito_factura_idx ON notas_credito (id_factura);
CREATE INDEX IF NOT EXISTS notas_credito_usuario_idx ON notas_credito (id_usuario);
CREATE INDEX IF NOT EXISTS devoluciones_factura_idx ON devoluciones (id_factura);
CREATE INDEX IF NOT EXISTS devoluciones_usuario_idx ON devoluciones (id_usuario);
CREATE INDEX IF NOT EXISTS cxc_paciente_idx ON cuentas_por_cobrar (id_paciente);
CREATE INDEX IF NOT EXISTS cxc_factura_idx ON cuentas_por_cobrar (id_factura);
CREATE INDEX IF NOT EXISTS cxp_proveedor_idx ON cuentas_por_pagar (id_proveedor);
CREATE INDEX IF NOT EXISTS cxp_orden_idx ON cuentas_por_pagar (id_orden_compra);
CREATE INDEX IF NOT EXISTS abonos_cxp_usuario_idx ON abonos_cxp (id_usuario);

-- La aplicacion usa una conexion PostgreSQL de servidor. Evita exponer datos
-- clinicos y financieros mediante las funciones REST/GraphQL publicas.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE recuperacion_password ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_previos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historias_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE examen_visual ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_compra_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_compra_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE factura_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE factura_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE promociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos_cxc ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_por_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos_cxp ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_usuario ENABLE ROW LEVEL SECURITY;
