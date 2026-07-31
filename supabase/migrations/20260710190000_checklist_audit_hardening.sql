-- Indices para filtros operativos y tokens de un solo uso.
CREATE UNIQUE INDEX IF NOT EXISTS recuperacion_password_token_unique_idx
ON recuperacion_password(token);

CREATE INDEX IF NOT EXISTS pacientes_activos_nombre_idx
ON pacientes (apellido, nombre) WHERE activo=TRUE;

CREATE INDEX IF NOT EXISTS pacientes_inactivos_nombre_idx
ON pacientes (apellido, nombre) WHERE activo=FALSE;

CREATE INDEX IF NOT EXISTS productos_activos_sku_idx
ON productos (sku) WHERE activo=TRUE AND sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS caja_turnos_cerrados_fecha_idx
ON caja_turnos (fecha DESC, id_cajero) WHERE estado='Cerrada';
