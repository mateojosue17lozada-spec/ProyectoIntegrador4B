#!/bin/bash
# Reconstruye la base de pruebas desde cero aplicando el DDL del repo mas los
# parches de entorno que documenta el informe (deriva de esquema).
set -e
P=/c/Users/user/Desktop/ProyectoIntegrador4B
docker exec optica-test psql -U postgres -q -c "DROP DATABASE IF EXISTS optica_test;" -c "CREATE DATABASE optica_test;" >/dev/null 2>&1
docker exec optica-test psql -U postgres -d optica_test -q -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;" >/dev/null 2>&1 || true
docker exec -i optica-test psql -U postgres -d optica_test -q < $P/database/tablas.sql >/dev/null 2>&1
for m in $P/supabase/migrations/*.sql; do docker exec -i optica-test psql -U postgres -d optica_test -q < "$m" >/dev/null 2>&1; done
# --- Parches de entorno (cada uno es una incidencia del informe) ---
docker exec -i optica-test psql -U postgres -d optica_test -q <<'SQL' >/dev/null 2>&1
-- INC-02: rol Paciente ausente y prohibido por CHECK
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_nombre_rol_check;
ALTER TABLE roles ADD CONSTRAINT roles_nombre_rol_check CHECK (nombre_rol IN ('Administrador','Optometra','Cajero','Vendedor','Paciente'));
INSERT INTO roles(nombre_rol,descripcion) VALUES('Paciente','Portal de paciente') ON CONFLICT DO NOTHING;
-- INC-03: tablas de pedidos web sin DDL en el repo
CREATE TABLE IF NOT EXISTS pedidos_pendientes (id_pedido SERIAL PRIMARY KEY, id_paciente INTEGER NOT NULL REFERENCES pacientes(id_paciente), subtotal NUMERIC(10,2) NOT NULL DEFAULT 0, impuestos NUMERIC(10,2) NOT NULL DEFAULT 0, total NUMERIC(10,2) NOT NULL DEFAULT 0, estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', observaciones TEXT, fecha_solicitud TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pedido_detalle (id_detalle SERIAL PRIMARY KEY, id_pedido INTEGER NOT NULL REFERENCES pedidos_pendientes(id_pedido) ON DELETE CASCADE, id_producto INTEGER REFERENCES productos(id_producto), cantidad INTEGER NOT NULL, precio_unitario NUMERIC(10,2) NOT NULL DEFAULT 0);
-- INC-04: columnas usadas por el codigo que el DDL no crea
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS es_simulada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(30);
-- INC-05: tablas que seedDemo trunca y no existen
CREATE TABLE IF NOT EXISTS password_reset_tokens(id SERIAL PRIMARY KEY);
CREATE TABLE IF NOT EXISTS tabla_prueba(id SERIAL PRIMARY KEY);
SQL
docker exec -i optica-test psql -U postgres -d optica_test -q < $P/supabase/migrations/20260906120000_pedido_prueba_virtual.sql >/dev/null 2>&1
cd $P/backend
export DATABASE_URL=postgresql://postgres:test123@localhost:55432/optica_test JWT_SECRET=clave_de_pruebas_local_no_produccion DB_SSL=false NODE_ENV=development
node src/scripts/seedDemo.js > /c/Users/user/AppData/Local/Temp/claude/C--Users-user-Desktop-ProyectoIntegrador4B/c5d824f0-b1ef-475f-bd41-5e56dc1149f7/scratchpad/seed-output.json 2>&1
echo "base reconstruida y sembrada"
