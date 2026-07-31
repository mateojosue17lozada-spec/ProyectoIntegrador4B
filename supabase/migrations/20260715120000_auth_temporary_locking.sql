-- Bloqueo temporal de autenticacion. Esta migracion no modifica contrasenas ni elimina usuarios.
ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ultimo_intento_fallido_en TIMESTAMPTZ;

COMMENT ON COLUMN public.usuarios.bloqueado_hasta IS 'Fin del bloqueo temporal por intentos fallidos';
COMMENT ON COLUMN public.usuarios.ultimo_intento_fallido_en IS 'Fecha del ultimo intento de autenticacion fallido';

-- ultimo_login ya existe y se conserva como fecha del ultimo acceso exitoso.
