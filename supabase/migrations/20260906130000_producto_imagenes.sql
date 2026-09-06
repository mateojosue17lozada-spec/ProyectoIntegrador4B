-- Galeria de imagenes por producto. La tabla ya existe en la base viva pero no
-- estaba versionada en el repositorio: sin este archivo, un despliegue limpio
-- (tablas.sql + migraciones) no la creaba y el catalogo fallaba al leer la
-- galeria. IF NOT EXISTS la hace idempotente contra la base actual.
--
-- imagen_data (en la tabla productos) sigue siendo la imagen principal/cover;
-- esta tabla guarda las imagenes adicionales del carrusel, ordenadas por `orden`.
CREATE TABLE IF NOT EXISTS producto_imagenes (
    id_imagen SERIAL PRIMARY KEY,
    id_producto INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
    ruta TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- El detalle del catalogo agrupa por producto y ordena por `orden`.
CREATE INDEX IF NOT EXISTS idx_producto_imagenes_producto_orden
    ON producto_imagenes (id_producto, orden);

-- Cada imagen es base64 comprimido en el cliente; el backend valida formato y
-- tamano (<=2.2 MB) con el helper imagen(). Este CHECK es la ultima linea de
-- defensa a nivel de datos.
ALTER TABLE producto_imagenes DROP CONSTRAINT IF EXISTS producto_imagenes_ruta_size_check;
ALTER TABLE producto_imagenes ADD CONSTRAINT producto_imagenes_ruta_size_check
    CHECK (octet_length(ruta) <= 2300000);
