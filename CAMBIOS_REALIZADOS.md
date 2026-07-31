# Cambios realizados

## Estado inicial preservado

- **Fecha:** 15 de julio de 2026.
- **Rama:** `main`, sincronizada inicialmente con `origin/main`.
- **Modificados previamente:** 32 rutas/archivos entre backend, frontend web y submódulo móvil; el diff inicial contenía 1.933 inserciones y 206 eliminaciones.
- **No versionados previamente:** documentos de auditoría, `rolesPermisos`, página de roles, utilidades web y migraciones `20260710120000`, `20260710163000`, `20260710190000`.
- **Migraciones encontradas:** dos del 3 de julio y tres del 10 de julio de 2026, además de la creada en esta fase.
- **Riesgo de conflicto:** alto en auth, app/server, frontend de sesión y usuarios porque ya tenían cambios locales.
- **Estrategia:** edición puntual sobre el contenido actual, sin restore/reset/clean, sin aplicar migraciones, sin commit ni push.

## Registro de esta iteración

| Fecha | Fase | Archivo | Cambio | Razón/impacto | Migración | Prueba |
|---|---|---|---|---|---|---|
| 2026-07-15 | 1 | `config/database.js` | Selección estricta de `TEST_DATABASE_URL` y patrones productivos prohibidos | Impide reutilizar silenciosamente desarrollo/producción en test | — | Integración protegida |
| 2026-07-15 | 1 | `config/schemaCheck.js`, `scripts/checkSchema.js` | Verificación de conexión, tablas, columnas e historial sin DDL | Readiness y diagnóstico reproducible | auth temporary locking | Unitarias |
| 2026-07-15 | 1 | `server.js`, `app.js` | DDL opcional, health/readiness y cierre SIGINT/SIGTERM con timeout | Arranque y apagado seguros | — | Unitarias/sintaxis |
| 2026-07-15 | 1 | `ensureSchema.js` | Desactivado por defecto y prohibido en producción | Evita deriva silenciosa | — | Unitaria |
| 2026-07-15 | 2 | `utils/logger.js` | Logger JSON y redacción recursiva | Evita secretos en contexto de logs | — | Logger redacta |
| 2026-07-15 | 2 | middleware/controlador/auth web | Eliminación de previews JWT y debug fijo | Reduce exposición en consola/observabilidad | — | Búsqueda + lint |
| 2026-07-15 | 2 | `auth.service.js` | Mensaje genérico, contador SQL atómico, bloqueo temporal, limpieza al éxito | Mitiga enumeración y carreras del contador | `20260715120000` | Auth security |
| 2026-07-15 | 2 | `email.js` | Transporte real deshabilitado en test | Evita correo accidental | — | Unitaria |
| 2026-07-15 | 2 | `usuarios.service.js` | Desbloqueo limpia fecha y queda auditado | Compatibilidad administrativa | `20260715120000` | Pendiente integración |
| 2026-07-15 | 1/2 | `package.json`, `test/**` | Scripts portables y suites unit/auth/integration | Base de pruebas segura | — | 16 unitarias |
| 2026-07-15 | Docs | documentación raíz | Cambios, pruebas, despliegue y matriz actualizados | Trazabilidad | — | Revisión diff |

## DDL auditado

`ensureSchema` repetía creación/alteración de auditoría, recuperación e intentos. Esas estructuras están cubiertas por `database/tablas.sql` y migraciones previas. Se conserva solo como puente explícito de desarrollo (`ALLOW_RUNTIME_DDL=true`), nunca en producción. La nueva columna de bloqueo se versionó exclusivamente en migración.

## Preparación para integración aislada

- `scripts/check-matrix.js`: valida 44 IDs, duplicados, faltantes y fuera de rango.
- `testDatabaseSafety.js`: exige entorno test, nombre marcado, desigualdad con desarrollo y patrones prohibidos.
- `testDatabase.js`: runner explícito, ordenado, transaccional e idempotente con historial.
- Pruebas nuevas para guards y matriz; readiness exige ahora la migración `20260715120000`.
- `.env.example`: cuenta SMTP sustituida por el dominio reservado `example.test`.

No se añadieron factories ni suites HTTP reales sin una base aislada. Las migraciones actuales son incrementales y presuponen el esquema base; se requiere un baseline aprobado antes de ofrecer un reset reproducible.

## Renovación UX/UI y perfiles

- Componentes compartidos en `frontend-web/src/components/ui.jsx` y guía `SISTEMA_DISENO.md`.
- Agenda de citas mensual/lista con consultas por rango, filtros y drawers accesibles.
- Endpoint de citas ampliado con filtros opcionales y profesional, sin romper consultas existentes.
- Pacientes con paginación opt-in de servidor y detalle contextual.
- Historia clínica con navegación de diez secciones.
- Facturación con resumen persistente de subtotal, total, pagado y saldo.
- `CrudPage` incorpora búsqueda, paginación visual y estados reutilizables.
- Menú, breadcrumbs, foco, tablas y responsive reforzados.
- `AUDITORIA_UX_UI.md` y `MATRIZ_VISUAL_PERMISOS.md` actualizados con pendientes reales.
