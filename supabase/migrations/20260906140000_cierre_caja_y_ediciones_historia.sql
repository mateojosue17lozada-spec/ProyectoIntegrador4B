-- === Cierre de caja completo (requerimiento Diana) ===
-- Estas columnas ya existen en la base viva pero no estaban versionadas en el
-- repositorio. IF NOT EXISTS las hace idempotentes y da paridad a un despliegue
-- limpio.
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS total_efectivo NUMERIC(10,2);
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS total_tarjeta NUMERIC(10,2);
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS total_transferencia NUMERIC(10,2);
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS total_credito NUMERIC(10,2);
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS retiro_banco NUMERIC(10,2);
ALTER TABLE caja_turnos ADD COLUMN IF NOT EXISTS responsable VARCHAR(150);

-- === Historial de ediciones de historia clinica (requerimiento Diana) ===
-- Cada edicion de una historia queda registrada con su motivo obligatorio. Los
-- datos clinicos van cifrados en historias_clinicas.datos_encriptados, por lo
-- que aqui se guarda el motivo y una referencia del campo, no el texto en claro.
CREATE TABLE IF NOT EXISTS historia_ediciones (
    id_edicion SERIAL PRIMARY KEY,
    id_historia INTEGER NOT NULL REFERENCES historias_clinicas(id_historia) ON DELETE CASCADE,
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    campo_modificado VARCHAR(80) NOT NULL DEFAULT 'datos_clinicos',
    valor_anterior TEXT,
    valor_nuevo TEXT,
    observacion TEXT NOT NULL,
    -- Marca si la edicion se hizo tras una autorizacion administrativa (fuera de
    -- las 24 h) y quien la autorizo.
    autorizada_por INTEGER REFERENCES usuarios(id_usuario),
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historia_ediciones_historia
    ON historia_ediciones (id_historia, fecha DESC);

-- === Bypass autorizado del bloqueo de 24 h (flujo de autorizacion admin) ===
-- El trigger sigue bloqueando la edicion de historias finalizadas pasadas las
-- 24 h para todos, salvo cuando una transaccion declara explicitamente el
-- bypass (lo hace SOLO el endpoint de desbloqueo, restringido a Administrador y
-- auditado). Asi Diana obtiene su "solicitar autorizacion" sin abrir la puerta
-- a ediciones silenciosas.
CREATE OR REPLACE FUNCTION public.impedir_edicion_historia_bloqueada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF OLD.estado = 'Finalizada' AND (OLD.bloqueada OR NOW() > OLD.editable_hasta)
       AND COALESCE(current_setting('app.bypass_bloqueo_historia', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'La historia clínica está bloqueada y no puede modificarse. Utilice adendas.';
    END IF;
    RETURN NEW;
END;
$function$;
