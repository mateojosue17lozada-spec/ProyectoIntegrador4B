-- Fotografias privadas servidas exclusivamente por el backend autenticado.
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS foto_data TEXT;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS forma_rostro VARCHAR(30);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_data TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS forma_montura VARCHAR(30);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS color_montura VARCHAR(40);

ALTER TABLE pacientes DROP CONSTRAINT IF EXISTS pacientes_foto_data_size_check;
ALTER TABLE pacientes ADD CONSTRAINT pacientes_foto_data_size_check CHECK (foto_data IS NULL OR octet_length(foto_data) <= 2200000);
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_imagen_data_size_check;
ALTER TABLE productos ADD CONSTRAINT productos_imagen_data_size_check CHECK (imagen_data IS NULL OR octet_length(imagen_data) <= 2200000);
