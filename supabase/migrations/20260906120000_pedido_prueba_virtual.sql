-- Probador virtual: la imagen compuesta (foto del paciente + montura) se
-- adjunta al detalle del pedido para que el optico revise el calce antes de
-- confirmar la venta.
--
-- Se guarda solo con consentimiento explicito del paciente (casilla en el
-- probador). El limite replica el de productos.imagen_data e impide que una
-- foto de camara sin optimizar entre a la tabla.

ALTER TABLE IF EXISTS pedido_detalle
    ADD COLUMN IF NOT EXISTS prueba_virtual_data TEXT;

ALTER TABLE IF EXISTS pedido_detalle
    DROP CONSTRAINT IF EXISTS pedido_detalle_prueba_virtual_size_check;

ALTER TABLE IF EXISTS pedido_detalle
    ADD CONSTRAINT pedido_detalle_prueba_virtual_size_check
    CHECK (prueba_virtual_data IS NULL OR octet_length(prueba_virtual_data) <= 2200000);
