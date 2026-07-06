CREATE INDEX IF NOT EXISTS facturas_promocion_idx ON public.facturas(id_promocion);

DO $$
BEGIN
  IF to_regclass('public.password_reset_tokens') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS password_reset_tokens_usuario_idx ON public.password_reset_tokens(id_usuario)';
  END IF;
END $$;

