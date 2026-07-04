INSERT INTO roles (nombre_rol, descripcion) VALUES
('Administrador','Acceso total al sistema'),
('Optometra','Gestion clinica y recetas'),
('Cajero','Facturacion, pagos y caja'),
('Vendedor','Ventas e inventario operativo')
ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO categorias_producto (nombre) VALUES
('Armazones'),
('Micas oftalmicas'),
('Lentes de contacto'),
('Soluciones')
ON CONFLICT (nombre) DO NOTHING;

-- Los usuarios se crean desde el modulo administrativo. No se incluye una
-- contrasena publica o compartida en los datos iniciales.
