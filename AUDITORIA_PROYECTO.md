# Auditoría técnica y funcional del proyecto

**Fecha de corte:** 15 de julio de 2026  
**Alcance:** inspección estática del repositorio, compilación/lint, pruebas existentes y conexión de solo lectura/pruebas transaccionales a la base configurada.  
**Estado:** auditoría inicial terminada; no se modificaron funcionalidades.

## 1. Resumen ejecutivo

El proyecto es una aplicación cliente-servidor avanzada, no un prototipo vacío. Dispone de frontend web, API REST, PostgreSQL alojado en Supabase y una aplicación móvil Expo todavía basada principalmente en la plantilla. La ruta funcional principal es React → `fetch` con JWT → Express → consultas parametrizadas con `pg` → PostgreSQL/Supabase.

La compilación web, los lint web/móvil y las cinco pruebas existentes pasan. Sin embargo, dichas pruebas validan principalmente existencia de esquema, RLS y tres triggers; no acreditan los flujos funcionales y de seguridad solicitados. El documento `docs/IMPLEMENTACION.md` declara los 44 requisitos cumplidos, pero la evidencia del código obliga a reclasificar numerosos puntos como parciales.

No se considera listo para producción. Hay riesgos altos en autenticación, auditoría clínica/financiera, cierre de caja, eliminación física de catálogos, cobertura de pruebas, migraciones y tratamiento de datos clínicos. No se encontró un error de compilación bloqueante.

## 2. Arquitectura encontrada

### Tecnologías y versiones

| Capa | Tecnología |
|---|---|
| Web | React 19.2.6, React Router 7.18, Vite 8.0.12, JavaScript, CSS |
| API | Node.js, CommonJS, Express 5.2.1 |
| Datos | PostgreSQL/Supabase, acceso directo con `pg` 8.22; no hay ORM |
| Seguridad | JWT 9.0.3, bcrypt 6, Helmet 8, CORS, express-rate-limit |
| Correo | Nodemailer 9 y alternativa Resend mediante HTTP |
| Móvil | Expo 54, React Native 0.81.5, TypeScript 5.9 |
| Pruebas | `node:test`; no hay pruebas de frontend ni E2E |

Los `package-lock.json` están presentes. Las versiones exactas instaladas pueden diferir de los rangos del manifiesto; el build reportó Vite 8.0.16.

### Estructura principal

- `backend/src`: configuración, middleware, utilidades y 13 módulos de rutas.
- `frontend-web/src`: autenticación, layout, páginas de dominio y cliente API.
- `frontend-movil`: aplicación Expo casi de plantilla, sin integración operativa demostrada.
- `database/tablas.sql` y `database/datos.sql`: esquema/semillas base.
- `supabase/migrations`: cinco migraciones incrementales encontradas.
- `backend/test`: una suite con cinco pruebas de esquema/invariantes.
- `docs/IMPLEMENTACION.md`: declaración previa de implementación, no equivalente a evidencia de aceptación.

### Flujo frontend → API → base de datos

El web usa `VITE_API_URL` (por defecto `http://localhost:3000/api`) y guarda JWT/usuario en `localStorage`. `apiFetch` envía Bearer tokens. Express aplica Helmet, CORS, JSON de hasta 3 MB, rate limit global y auditoría HTTP; las rutas usan autenticación y listas de roles. Los servicios ejecutan SQL parametrizado mediante un pool `pg`. No se usa `supabase-js` ni Supabase Auth: Supabase actúa como PostgreSQL administrado.

### Autenticación y autorización

- Usuarios propios en `usuarios`, contraseñas bcrypt y JWT de 8 horas.
- Sesiones persistidas por `jti` en `sesiones_usuario`; logout y cambio de contraseña revocan sesiones.
- Recuperación con 32 bytes aleatorios y SHA-256 del token almacenado.
- Autorización backend mediante listas de roles por ruta; el frontend repite visibilidad/rutas.
- Existe un catálogo de permisos, pero no un motor de permisos por acción persistente y aplicado uniformemente.

### Errores, configuración e integraciones

- Hay middleware global de errores y helper HTTP.
- `.env` está ignorado y no versionado; `.env.example` sí está versionado y no expone valores reales.
- El backend valida variables esenciales al arrancar, aunque `DB_SSL` y `PORT` no están documentadas en el ejemplo.
- Correo por Gmail/Nodemailer o Resend. Facturación electrónica SRI no está integrada.
- Las imágenes se guardan como data URI en PostgreSQL, sin Storage; esto incrementa tamaño de filas/backups.
- No se halló generador PDF del servidor. La impresión depende principalmente del navegador.

### Migraciones, RLS y auditoría

El repositorio contiene migraciones con fecha 3 y 10 de julio de 2026. Las pruebas conectadas confirman tablas operativas, RLS en todas las tablas públicas verificadas y triggers `historias_bloqueo_legal`, `historias_validar_pago` y `auditoria_inmutable`. No se verificó de forma concluyente que las tres migraciones no versionadas del 10 de julio estén registradas en el historial remoto.

RLS está habilitado y el diseño pretende acceso solo desde el backend. Esto reduce exposición por Data API, pero debe verificarse también con `GRANT`, políticas y roles reales. Supabase anunció en 2026 cambios para que tablas nuevas no se expongan automáticamente; no sustituye la revisión explícita de permisos.

La auditoría registra usuario, acción, tabla, registro, detalle, IP y user-agent. Es de mejor esfuerzo: si falla, la operación principal continúa. No captura sistemáticamente rol, resultado fallido, valores anteriores/nuevos ni motivo; algunas mutaciones carecen de auditoría específica.

## 3. Instrucciones de ejecución

### Requisitos

- Node.js compatible con Vite 8/Express 5 (documentar y fijar versión LTS antes de producción).
- npm.
- PostgreSQL/Supabase accesible mediante TLS.

### Variables del backend

Copiar `backend/.env.example` a `backend/.env` y definir: `DATABASE_URL`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `CORS_ORIGIN`, `FRONTEND_URL`, `DB_POOL_MAX`, `SMTP_SERVICE`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `EMAIL_FROM`, `RESEND_API_KEY` y `NODE_ENV`. El código también admite `PORT` y `DB_SSL`; deben añadirse al ejemplo. No reutilizar JWT como clave de cifrado en producción.

### Backend

```bash
cd backend
npm ci
npm run dev
```

Producción: `npm start`. Pruebas: `npm test`. Verificación de correo: `npm run email:verify` (envía correo real). La suite actual usa la base definida en `DATABASE_URL`, por lo que debe apuntar a un entorno de pruebas aislado aunque use rollback en el escenario destructivo.

### Frontend web

```bash
cd frontend-web
npm ci
npm run dev
npm run lint
npm run build
```

Definir `VITE_API_URL` cuando la API no esté en `http://localhost:3000/api`.

### Frontend móvil

```bash
cd frontend-movil
npm ci
npm start
npm run lint
```

La app móvil no acredita aún flujos del negocio.

### Base de datos y migraciones

El esquema base está en `database/tablas.sql`; las evoluciones están en `supabase/migrations`. Para un entorno nuevo debe usarse Supabase CLI con un proyecto aislado y revisar primero `npx supabase --help`; luego aplicar migraciones en orden. No ejecutar `database/datos.sql` en producción sin revisar si contiene datos de demostración. Antes de desplegar: backup, ensayo de restauración, comparación de historial y ejecución de advisors.

## 4. Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| `backend: npm test` | 5/5 aprobadas; 4.46 s |
| `frontend-web: npm run build` | Aprobado; bundle JS 346.59 kB, imagen login 1.64 MB |
| `frontend-web: npm run lint` | Aprobado |
| `frontend-movil: npm run lint` | Aprobado |
| Estado Git | Árbol sucio con numerosos cambios previos y tres migraciones no versionadas; preservados |

No hay script de lint del backend, pruebas unitarias de servicios, pruebas web, E2E ni build móvil automatizado. No se ejecutó `npm audit` en esta auditoría porque podría requerir red y no aporta prueba funcional.

## 5. Problemas encontrados

### Críticos

No se confirmó una vulnerabilidad explotable inmediata que justifique una corrección destructiva. Sí existen varios riesgos altos que impiden declarar producción.

### Altos

| ID | Módulo/archivos | Descripción y riesgo | Causa probable | Solución propuesta/dependencias |
|---|---|---|---|---|
| A-01 | Auth: `auth.service.js`, `auth.middleware.js`, `AuthContext.jsx` | Mensajes distinguen bloqueo y contador; logs incluyen prefijos del JWT y `AUTH_DEBUG=true`. Facilita enumeración/filtración en observabilidad. | Depuración temporal y requisitos contradictorios. | Mensaje externo genérico, eventos internos sanitizados, debug por entorno y nunca registrar token. Probar login/bloqueo. |
| A-02 | Auth/usuarios | Bloqueo al tercer intento no guarda fecha ni tiene desbloqueo temporizado; solo reset/admin. | Modelo incompleto. | Migración con `bloqueado_hasta`, política configurable, auditoría de bloqueo/desbloqueo y concurrencia atómica. |
| A-03 | Auditoría: `audit.js`, middleware y servicios | Auditoría es asíncrona/mejor esfuerzo, no registra fallos, rol ni before/after de forma consistente; operaciones sensibles pueden quedar sin trazabilidad. | Helper genérico fuera de transacciones. | Modelo de eventos completo, redacción, auditoría transaccional para finanzas/clínica y pruebas de inmutabilidad. |
| A-04 | Caja: `caja.service.js` | Cierre no usa transacción/bloqueo de fila, no exige observación con diferencia y calcula solo efectivo sin ingresos/egresos/arqueo por forma. Doble cierre concurrente posible. | Implementación mínima. | `FOR UPDATE`, transición condicional y transacción; movimientos, arqueo por forma, motivo y prueba concurrente. |
| A-05 | Historia: `historia.service.js`, esquema | Secciones clínicas se cifran juntas en JSON; no hay M:N de CIE-10, estados/adendas/versiones completos. El plazo base se define al crear, no al finalizar. | Simplificación del modelo. | Máquina de estados, `finalizada_en`, adendas inmutables, diagnósticos relacionados y validación profesional. |
| A-06 | Pruebas: `backend/test/schema.test.js` | Solo cinco pruebas; faltan casi todos los casos obligatorios. Los claims de cumplimiento no son verificables. | Enfoque centrado en esquema. | Pirámide de pruebas con DB aislada, servicios/API, frontend y E2E; reloj inyectable. |
| A-07 | Migraciones/config | `ensureSchema` ejecuta DDL al arranque y convive con SQL base/migraciones; tres migraciones están sin versionar en Git. Riesgo de deriva y despliegue no reproducible. | Evolución incremental sin una única autoridad. | Migraciones como única fuente, verificación de historial/checksum y eliminar DDL de runtime tras transición. |

### Medios

| ID | Módulo/archivos | Descripción y riesgo | Solución propuesta |
|---|---|---|---|
| M-01 | Pacientes | Solo admite cédula ecuatoriana obligatoria; faltan tipo de identificación, contacto de emergencia, fecha futura/longitudes/teléfono y paginación real (`LIMIT 500`). | Modelo de identificaciones, validadores compartidos, filtros/paginación/orden servidor e índices. |
| M-02 | Citas | Conflicto bloquea cualquier profesional en la misma hora, no solo el asignado; no hay duración/rango ni máquina de transiciones. Cancelación no exige motivo. | Restricción/índice por profesional y rango, transiciones explícitas y auditoría before/after. |
| M-03 | Pagos previos | No hay anulación, comprobante, saldo/aplicación única a factura ni idempotencia visible. “Mixto” se acepta como una sola línea. | Modelo de aplicaciones/anulaciones, referencia idempotente y conciliación transaccional. |
| M-04 | Facturación | Impuesto llega como monto libre; pago mixto no exige suma igual al total (se permite crédito implícito); número temporal puede colisionar; devolución puede reponer todos los detalles aunque sea parcial. | Reglas fiscales configuradas, secuencia DB, líneas de devolución y conciliación exacta. |
| M-05 | Inventario | Producto contiene variantes en la misma fila; faltan reservado/disponible, trazabilidad completa y paginación. Ajuste no valida catálogo de tipos/motivo ni guarda anterior/resultante. | Producto-variante, movimientos ledger, reservas, paginación e índices. |
| M-06 | Compras/proveedores/inventario | Hay `DELETE` físico de proveedor/categoría; recepción es total, no parcial, y no crea movimiento de inventario visible por cada entrada. | Desactivación, recepción parcial con saldos y ledger transaccional. |
| M-07 | Cartera | Rangos no incluyen “por vencer” y etiquetan deuda futura como `0-30`; no hay fecha de corte/filtros/exportación. Consultar listados muta estados. | Consulta pura parametrizada por corte y proceso programado separado. |
| M-08 | Seguridad de transporte | Pool usa `rejectUnauthorized:false` para destinos remotos detectados. | Configurar CA/verificación en producción y documentar excepción local. |
| M-09 | Sesión web | JWT en `localStorage` eleva impacto de XSS; no hay inactividad deslizante ni CSP específica demostrada. | Evaluar cookies HttpOnly/SameSite + CSRF o endurecer CSP y expiración/inactividad. |
| M-10 | Imágenes | Fotos/data URI se almacenan en filas y pasan por JSON de 3 MB. | Storage privado con validación MIME/tamaño, URLs firmadas y políticas. |
| M-11 | Roles | Matriz es catálogo estático y listas dispersas; inconsistencias (Optómetra ve inventario backend pero no frontend). | Fuente única de permisos por acción, tests de contrato y deny-by-default. |
| M-12 | Móvil | Expo es plantilla, sin autenticación ni módulos. | Definir si entra al alcance; si sí, plan y API compartida. |

### Bajos

- Documentación con caracteres mojibake en varios archivos y mensajes.
- Código de varios servicios minificado en una línea, reduciendo mantenibilidad/revisión.
- Imagen de login de 1.64 MB sin optimizar.
- README describe un alcance menor y pruebas manuales, desalineado con el código actual.
- Faltan health check, logging estructurado/rotación y documentación de backup/restauración.

## 6. Estado preliminar de los 44 requisitos

Resumen de la matriz detallada en `MATRIZ_CUMPLIMIENTO.md`:

| Estado | Cantidad |
|---|---:|
| Cumple | 1 |
| Cumple parcialmente | 42 |
| No cumple | 1 |
| No implementado | 0 |
| No verificable | 0 |

La única conformidad fuerte en esta fase es el vínculo básico factura–receta–historia/paciente. Incluso allí faltan pruebas de aceptación. El resultado no invalida el trabajo existente: indica que la definición solicitada es más amplia que la presencia de tablas/pantallas.

## 7. Riesgos críticos para salida a producción

1. Cobertura insuficiente de flujos clínicos, financieros y de seguridad.
2. Auditoría no garantizada dentro de transacciones sensibles.
3. Modelo legal de historia/adendas y cómputo de 24 horas incompletos.
4. Concurrencia de caja y varios documentos financieros no probada.
5. Migraciones/DDL de arranque sin una fuente única y árbol Git actualmente sucio.
6. Token en `localStorage`, trazas con prefijo y mensajes de login informativos.
7. Ausencia de facturación electrónica SRI; no puede anunciarse facturación productiva ecuatoriana.
8. Backups, restauración, monitoreo, retención clínica y respuesta a incidentes no demostrados.

## 8. Orden recomendado

1. Congelar baseline, consolidar migraciones y crear entorno de pruebas aislado.
2. Corregir auth/logs/bloqueo y establecer pruebas de API.
3. Hacer auditoría transaccional y permisos por acción.
4. Corregir caja/facturación/pagos/inventario con concurrencia.
5. Completar estados clínicos, adendas y diagnósticos.
6. Pacientes/citas/pago previo con modelos y paginación.
7. Compras, inventario y cartera.
8. UX, reportes, móvil si se confirma alcance, y preparación operativa.

## 9. Archivos para inspección adicional

- `supabase/migrations/*.sql` contra el historial remoto y advisors.
- `database/datos.sql` y `backend/src/scripts/seedDemo.js` en una base descartable.
- Todas las rutas/servicios financieros con pruebas concurrentes.
- `frontend-web/src/pages/**` mediante pruebas de interacción y accesibilidad.
- Configuración real de Supabase: grants, políticas, backups/PITR, red y versiones.
- Requisitos profesionales/académicos para campos clínicos, conservación y adendas.

## 10. Límites de la auditoría

No se inspeccionó el contenido de secretos, no se envió correo, no se aplicaron migraciones, no se sembraron datos y no se realizaron operaciones irreversibles. La revisión del video de referencia no es necesaria para validar seguridad/integridad en esta fase y debe reservarse para UX. Las conclusiones sobre producción requieren además pruebas en staging, revisión legal local y validación por un profesional optometrista/contable.
