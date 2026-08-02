-- Migración del Módulo Clínico (Historias, Citas y Diagnósticos)

-- 1. Actualizar Citas
ALTER TABLE public.citas
    ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;

CREATE INDEX IF NOT EXISTS citas_usuario_fecha_hora_idx ON public.citas (id_usuario, fecha_cita, hora_cita);

-- 2. Actualizar Historias Clínicas
ALTER TABLE public.historias_clinicas
    ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'Borrador' CHECK (estado IN ('Borrador', 'Finalizada')),
    ADD COLUMN IF NOT EXISTS finalizada_en TIMESTAMP;

-- 3. Modificar el trigger de Bloqueo Legal
CREATE OR REPLACE FUNCTION impedir_edicion_historia_bloqueada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF OLD.estado = 'Finalizada' AND (OLD.bloqueada OR NOW() > OLD.editable_hasta) THEN
        RAISE EXCEPTION 'La historia clínica está bloqueada y no puede modificarse. Utilice adendas.';
    END IF;
    RETURN NEW;
END;
$$;

-- 4. Nueva tabla: Diagnósticos M:N
CREATE TABLE IF NOT EXISTS public.historia_diagnosticos (
    id_diagnostico SERIAL PRIMARY KEY,
    id_historia INTEGER NOT NULL REFERENCES public.historias_clinicas(id_historia) ON DELETE CASCADE,
    codigo_cie10 VARCHAR(20) NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'Principal' CHECK (tipo IN ('Principal', 'Secundario')),
    observacion TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS historia_diagnosticos_historia_idx ON public.historia_diagnosticos (id_historia);
ALTER TABLE public.historia_diagnosticos ENABLE ROW LEVEL SECURITY;

-- 5. Nueva tabla: Adendas
CREATE TABLE IF NOT EXISTS public.historia_adendas (
    id_adenda SERIAL PRIMARY KEY,
    id_historia INTEGER NOT NULL REFERENCES public.historias_clinicas(id_historia) ON DELETE CASCADE,
    id_usuario INTEGER NOT NULL REFERENCES public.usuarios(id_usuario),
    contenido TEXT NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS historia_adendas_historia_idx ON public.historia_adendas (id_historia);
ALTER TABLE public.historia_adendas ENABLE ROW LEVEL SECURITY;
