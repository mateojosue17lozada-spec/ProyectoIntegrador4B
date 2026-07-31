-- Operacion documental de compras, arqueos auditables y esquema ocular clinico.
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS condiciones_pago TEXT;
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_entrega_estimada DATE;
ALTER TABLE recepciones_compra ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS ventas_efectivo NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS efectivo_esperado NUMERIC(10,2);
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS diferencia NUMERIC(10,2);
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE examen_visual ADD COLUMN IF NOT EXISTS esquema_ocular JSONB NOT NULL DEFAULT '{"od":{"hallazgo":"Normal","color":"#22c55e","severidad":0},"oi":{"hallazgo":"Normal","color":"#22c55e","severidad":0}}'::jsonb;

CREATE TABLE IF NOT EXISTS devoluciones_proveedor (
    id_devolucion_proveedor SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id_proveedor),
    id_recepcion INTEGER REFERENCES recepciones_compra(id_recepcion),
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    numero_nota_credito VARCHAR(100),
    motivo TEXT NOT NULL,
    total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'Emitida' CHECK (estado IN ('Emitida','Aplicada','Cancelada')),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devolucion_proveedor_detalle (
    id_detalle SERIAL PRIMARY KEY,
    id_devolucion_proveedor INTEGER NOT NULL REFERENCES devoluciones_proveedor(id_devolucion_proveedor) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(10,2) NOT NULL CHECK (costo_unitario >= 0)
);

CREATE INDEX IF NOT EXISTS caja_turnos_fecha_cajero_idx ON caja_turnos (abierto_en DESC, id_cajero);
CREATE INDEX IF NOT EXISTS devoluciones_proveedor_proveedor_idx ON devoluciones_proveedor (id_proveedor, creado_en DESC);
CREATE INDEX IF NOT EXISTS devoluciones_proveedor_recepcion_idx ON devoluciones_proveedor (id_recepcion);
CREATE INDEX IF NOT EXISTS devolucion_proveedor_detalle_producto_idx ON devolucion_proveedor_detalle (id_producto);

ALTER TABLE devoluciones_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucion_proveedor_detalle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON devoluciones_proveedor, devolucion_proveedor_detalle FROM anon, authenticated;
REVOKE ALL ON SEQUENCE devoluciones_proveedor_id_devolucion_proveedor_seq, devolucion_proveedor_detalle_id_detalle_seq FROM anon, authenticated;
