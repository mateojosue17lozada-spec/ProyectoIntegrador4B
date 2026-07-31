# Pruebas realizadas

## Corte 15 de julio de 2026

| Comando | Entorno/base | Resultado | Duración observada | Incidencias |
|---|---|---|---:|---|
| `backend: npm ci` | Dependencias limpias | Aprobado, 130 paquetes | 12,5 s | Ninguna |
| `npm test` | Unitario, `NODE_ENV=test`, sin DB | 16 aprobadas, 0 fallidas | 0,227 s | Ninguna |
| `npm run test:auth` | Unitario, sin DB/correo | 12 aprobadas, 0 fallidas | 0,202 s | Ninguna |
| `npm run test:integration` | Requiere `TEST_DATABASE_URL` | 0 aprobadas, 0 fallidas, 1 omitida | 0,198 s | Base aislada no proporcionada; no se reutilizó `DATABASE_URL` |
| `node --check` en auth/server/app/config | Sin DB | 5 archivos válidos | 3,8 s | Ninguna |
| `npm run db:check` | Base de desarrollo, solo lectura | `ready:false`; falta migración de bloqueo | 6,3 s junto con guard test | Resultado esperado: migración no aplicada |
| guard `NODE_ENV=test` sin URL | Sin DB | Rechazo correcto | incluido arriba | Exige `TEST_DATABASE_URL` |
| `frontend-web: npm ci` | Dependencias limpias | Aprobado, 140 paquetes | 53,8 s | Ninguna |
| `frontend-web: npm run lint` | Local | Aprobado | 16,1 s | Ninguna |
| `frontend-web: npm run build` | Producción | Aprobado, 1.804 módulos | 7,2 s total; build 1,50 s | Bundle JS 344,87 kB |
| `frontend-movil: npm ci` | Dependencias limpias | Aprobado, 921 paquetes | 89,2 s segundo intento | Primer intento agotó 120 s; avisos de dependencias transitivas obsoletas |
| `frontend-movil: npm run lint` | Local | Aprobado | 18,5 s | Ninguna |

No se incluyen URL, credenciales ni nombres sensibles.

## Cobertura incorporada

- Redacción de secretos, ausencia de previews JWT y debug condicionado.
- Mensaje genérico de login.
- Evidencia del incremento SQL atómico, bloqueo configurable y limpieza al éxito.
- Usuario activo y revocación en recuperación.
- Correo deshabilitado en test.
- Migración no destructiva y DDL de arranque restringido.
- Health/readiness y contrato básico de cuatro roles.

## Cobertura pendiente por falta de base aislada

No se consideran acreditados aún los escenarios reales de login concurrente, JWT válido/vencido/revocado, logout, recuperación válido/vencido/usado y permisos HTTP. Para ejecutarlos debe crearse una base cuyo nombre incluya `test`, `prueba` o `ci`, aplicar las migraciones y definir `TEST_DATABASE_URL`. La suite rechaza patrones de `TEST_DATABASE_FORBIDDEN_PATTERNS`.

## Validación de cierre intentada (15 de julio de 2026)

| Comando | Base sanitizada | Aprobadas | Fallidas | Omitidas | Duración | Resultado |
|---|---|---:|---:|---:|---:|---|
| `backend: npm ci` | No aplica | 130 paquetes | 0 | 0 | 9,6 s | Aprobado |
| `npm test` | Sin DB | 21 | 0 | 0 | 0,281 s | Aprobado; guard de URL igual y matriz 1–44 |
| `npm run test:auth` | Sin DB | 12 | 0 | 0 | 0,171 s | Aprobado |
| `npm run test:integration` | No configurada | 0 | 0 | 1 | 0,144 s | No acreditado; falta `TEST_DATABASE_URL` |
| `npm run db:test:check` | No configurada | 0 | 1 | 0 | <1 s | Rechazo seguro antes de conectar |
| `npm run db:test:migrate` | No configurada | 0 | 1 | 0 | <1 s | Rechazo seguro; ninguna migración aplicada |
| `frontend-web: npm ci`, lint y build | No aplica | 3 etapas | 0 | 0 | 84,1 s | Aprobado; 1.804 módulos |
| `frontend-movil: npm ci` y lint | No aplica | 2 etapas | 0 | 0 | 110 s | Aprobado; avisos transitivos |
| `npm run matrix:check` | No aplica | 44 filas | 0 | 0 | <1 s | IDs únicos, rango 1–44 |

Login real, concurrencia, recuperación, JWT, permisos HTTP y readiness PostgreSQL permanecen pendientes. No se accedió a `DATABASE_URL` ni se envió correo.

## Verificación UX/UI

| Comando/verificación | Resultado |
|---|---|
| `frontend-web: npm run lint` | Aprobado, 0 errores |
| `frontend-web: npm run build` | Aprobado, 1.805 módulos |
| `backend: npm test` | 23 aprobadas, 0 fallidas |
| Paginación real de pacientes | 5 filas de 9, 2 páginas |
| Consulta mensual de citas | 8 filas; todas incluyen profesional |
| `git diff --check` | Aprobado tras corregir espacios finales |
