# Despliegue a producción — guía preliminar

> El sistema todavía no se declara listo para producción.

## Previo

1. Congelar cambios y revisar migraciones en orden.
2. Crear backup consistente de PostgreSQL/Supabase y verificar restauración en un proyecto aislado.
3. Ejecutar `npm ci`, unitarias, integración contra `TEST_DATABASE_URL`, lint y build.
4. Comparar `supabase_migrations.schema_migrations` con `supabase/migrations` y ejecutar advisors.

## Migraciones

Usar una versión compatible de Supabase CLI y descubrir sintaxis con `npx supabase --help`. Aplicar primero en staging. La CLI falló en la estación Windows auditada por ausencia de binario `win32-x64`; resolver la instalación antes de despliegue. Nunca ejecutar `database/tablas.sql` sobre una base existente como sustituto de migraciones.

La migración de esta fase es `20260715120000_auth_temporary_locking.sql`. El rollback lógico, si fuera imprescindible, consiste en desplegar primero código que deje de usar las columnas; su eliminación física se pospone a una ventana posterior y exige backup. No eliminar columnas inmediatamente.

## Variables obligatorias

`NODE_ENV`, `PORT`, `DATABASE_URL`, `DB_SSL`, `DB_POOL_MAX`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `CORS_ORIGIN`, `FRONTEND_URL`, `LOGIN_LOCK_MINUTES`, `AUTH_DEBUG=false` y configuración de correo. `TEST_DATABASE_URL` solo en test. No registrar valores.

`ALLOW_RUNTIME_DDL` debe permanecer `false` o ausente. `ensureSchema` lanza error en producción incluso si alguien intenta habilitarlo.

## Verificación

- `GET /health`: proceso vivo; no consulta DB.
- `GET /ready`: conexión y columnas esenciales; 200 disponible, 503 no disponible.
- `npm run db:check`: verificación de solo lectura, muestra únicamente estado, faltantes y versión.

## Backup y restauración

Usar backups administrados/PITR de Supabase según el plan contratado y, antes de cada migración, un backup lógico compatible con la versión PostgreSQL. Restaurar en un proyecto aislado, aplicar migraciones y ejecutar integración. Registrar RPO/RTO y responsable; no basta con comprobar que el backup existe.

## Restricciones

- No seed demo, DDL runtime ni correos de prueba en producción.
- No desplegar si readiness falla, existen migraciones pendientes o la integración está omitida.
- No exponer Data API sin revisar grants/RLS; el backend usa conexión PostgreSQL confiable.

## Preparación exacta de staging/test

1. Crear una base separada cuyo nombre contenga `test`, `prueba` o `ci`.
2. Proporcionar un baseline migratorio revisado; las migraciones actuales no crean todas las tablas desde una base vacía.
3. Definir localmente `NODE_ENV=test`, `TEST_DATABASE_URL` y `TEST_DATABASE_FORBIDDEN_PATTERNS`; mantener `DATABASE_URL` distinta.
4. Ejecutar `npm run db:test:check`, `npm run db:test:migrate`, `npm run test:integration` y nuevamente `npm run db:test:check`.
5. Exigir `/ready` 200 y `20260715120000` en el historial antes de promover.

El runner revierte la migración en curso si falla y se detiene; no revierte migraciones previas confirmadas. Nunca debe usarse reset sobre staging compartido o producción. No se ofrece `db:test:reset` mientras falte un baseline reproducible. Producción continúa bloqueada mientras la integración esté omitida o falten pruebas reales de concurrencia, recuperación, JWT y roles.
