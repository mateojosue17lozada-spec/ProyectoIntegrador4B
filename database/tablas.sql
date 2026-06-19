CREATE TABLE usuarios(

id_usuario SERIAL PRIMARY KEY,

nombre_usuario VARCHAR(100) NOT NULL,

correo_usuario VARCHAR(100) UNIQUE NOT NULL,

clave_usuario VARCHAR(100) NOT NULL,

fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);