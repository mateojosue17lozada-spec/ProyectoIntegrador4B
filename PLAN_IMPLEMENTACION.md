# Plan incremental de implementación

**Base:** hallazgos de `AUDITORIA_PROYECTO.md` y `MATRIZ_CUMPLIMIENTO.md`.  
**Principio:** una fase no se cierra hasta aprobar backend, base de datos, permisos, frontend y pruebas aplicables. Toda migración será incremental y reversible cuando sea viable.

## Precondiciones

1. Separar base de desarrollo/pruebas/producción y crear respaldo verificable.
2. Confirmar qué cambios locales actuales pertenecen al equipo antes de integrar.
3. Consolidar `database/tablas.sql`, `ensureSchema` y migraciones en una fuente reproducible.
4. Fijar Node LTS, ejecutar `npm ci`, advisors y registrar baseline de rendimiento/seguridad.
5. Acordar con responsable clínico/legal el cómputo desde finalización, adendas y retención.

## Fase 1 — Errores críticos y estabilidad

**Objetivo:** obtener una línea base reproducible y pruebas de API/DB aisladas.

- Archivos probables: configuración DB/server, `ensureSchema.js`, migraciones, `backend/test/**`, CI.
- DB: reconciliar historial; no cambiar datos productivos sin backup/ensayo.
- Endpoints: health/readiness y contratos de error.
- Frontend: cliente API y pantalla de indisponibilidad, si procede.
- Reglas/validaciones: entorno obligatorio, timeouts, shutdown correcto.
- Pruebas: arranque, health, migración desde snapshot, rollback y restauración.
- Aceptación: instalación limpia + migraciones + test/build/lint repetibles; cero DDL implícito al arrancar.

## Fase 2 — Seguridad y autenticación

**Objetivo:** corregir enumeración, logs, bloqueo temporal, recuperación y permisos por acción.

- Archivos: auth/usuarios, middleware, auditoría, AuthContext, ProtectedRoute, Layout, `.env.example`.
- DB: `bloqueado_hasta`, eventos de seguridad, permisos/rol-acción y restricciones únicas normalizadas.
- Endpoints: login, logout, recuperación/validación/reset, perfil, cambio de contraseña, administración de desbloqueo.
- Reglas: mensaje genérico, token nunca registrado, incremento atómico, activo obligatorio, revocación y deny-by-default.
- Pruebas: login correcto/incorrecto, tercero, desbloqueo, token válido/vencido/usado, sesiones, permisos de cuatro roles.
- Aceptación: matriz backend/frontend coincidente, logs sanitizados y suite de seguridad aprobada.

## Fase 3 — Pacientes, citas y pagos previos

**Objetivo:** modelo de identificación flexible, agenda sin cruces y anticipos conciliables.

- Archivos: módulos/páginas pacientes y citas.
- DB: tipos de identificación, contacto emergencia/catálogos; duración/rango de cita; aplicación/anulación de anticipos; índices.
- Endpoints: listados paginados/ordenados, reprogramación, transiciones, anular/aplicar pago.
- Reglas: cédula solo para tipo correspondiente, fecha no futura, conflicto por profesional, cancelación con motivo, idempotencia.
- Pruebas: duplicados, validaciones, filtros, cruces, transiciones, doble pago/anulación.
- Aceptación: flujo paciente→cita→anticipo completo y auditable sin cargar listados masivos.

## Fase 4 — Historias clínicas

**Objetivo:** historia estructurada, legalmente trazable y corregible por adenda.

- Archivos: historia/exámenes y formularios clínicos.
- DB: estados borrador/finalizada/bloqueada/anulada, `finalizada_en`, adendas/versiones, diagnósticos M:N y campos clínicos aprobados.
- Endpoints: finalizar, bloquear, crear adenda, anular con permiso; catálogo CIE-10.
- Reglas: servidor calcula 24 h desde finalización, no borrado físico, consentimiento/firma, acceso clínico mínimo.
- Pruebas: examen externo, todas las secciones, antes/después de 24 h con reloj inyectable, adenda e impresión.
- Aceptación: contenido anterior inmutable y cada corrección conserva autor/fecha/motivo/diferencias.

## Fase 5 — Recetas y laboratorio

**Objetivo:** generar receta desde resultado final y trazar laboratorio/ensamblaje.

- Archivos: recetas backend/web y generador documental.
- DB: numeración, versión/reimpresión, estados/historial de pedido, ensamblaje/QC/incidencias.
- Endpoints: generar/vista previa/PDF, cambiar estado con transición, QC/entrega.
- Reglas: no duplicar datos clínicos, receta solo de historia válida, transiciones autorizadas.
- Pruebas: generación, reimpresión, vínculo, estados inválidos y entrega.
- Aceptación: historia→receta→pedido→ensamblaje→entrega trazable.

## Fase 6 — Facturación y caja

**Objetivo:** consistencia monetaria, fiscal y concurrente.

- Archivos: factura/caja, páginas y componentes de pago.
- DB: secuencias, impuestos, movimientos de caja, arqueo por forma, líneas de devolución/notas.
- Endpoints: apertura, ingreso/egreso, arqueo/cierre; factura/pagos; devolución/anulación.
- Reglas: caja abierta, sumas exactas, decimal, locks, motivo/diferencia, idempotencia, no reapertura ordinaria.
- Pruebas: doble cierre, pago mixto, totales, caja cerrada, stock, devolución parcial y reversión.
- Aceptación: factura/pagos/stock/cartera/caja se confirman o revierten juntos.

## Fase 7 — Compras y proveedores

**Objetivo:** ciclo de compra con recepción parcial y costos históricos.

- Archivos: compras backend/web.
- DB: baja lógica, condiciones, aprobaciones, recepciones parciales/lotes y costos históricos.
- Endpoints: aprobar, recibir parcial, devolver, historial.
- Reglas: no exceder pendiente, idempotencia, movimiento por recepción y CxP consistente.
- Pruebas: recepción parcial/doble/concurrente, costo promedio y devolución.
- Aceptación: orden→recepciones→stock/costo→CxP reconciliable.

## Fase 8 — Inventario

**Objetivo:** producto-variante, reservas y ledger inmutable.

- Archivos: inventario backend/web.
- DB: producto/variante, reservado/disponible, movimiento con anterior/cambio/resultante, índices.
- Endpoints: búsqueda paginada/autocomplete/barcode, reservar/liberar/ajustar.
- Reglas: nunca editar existencia directamente, tipos/motivo/aprobación, unicidad.
- Pruebas: último stock concurrente, barcode manual/lector, ajuste y mínimos.
- Aceptación: toda existencia se explica por movimientos y responde rápido con miles de variantes.

## Fase 9 — Cartera

**Objetivo:** CxC/CxP auditables, aging correcto y política de crédito configurable.

- Archivos: cartera/facturación y página.
- DB: comprobantes, vencimientos, política/override y snapshots de corte.
- Endpoints: filtros/fecha de corte, abonos, aging, autorización excepcional.
- Reglas: rangos por vencer/1–30/31–60/61–90/+90; contado nunca bloqueado.
- Pruebas: fronteras de fecha, abono concurrente, bloqueo/override.
- Aceptación: totales de aging concilian con saldos y cada excepción queda auditada.

## Fase 10 — Auditoría y reportes

**Objetivo:** trazabilidad completa y reportes basados en datos confiables.

- Archivos: audit middleware/helper, servicios y dashboards.
- DB: evento con rol, resultado, before/after redacted, motivo y correlación; índices/retención.
- Endpoints/UI: consulta/exportación por permiso.
- Reglas: auditoría dentro de transacción para acciones sensibles; jamás secretos/datos excesivos.
- Pruebas: éxito/fallo, inmutabilidad, redacción y acceso por rol.
- Aceptación: operaciones requeridas localizables y exportaciones concilian.

## Fase 11 — Experiencia de usuario

**Objetivo:** formularios accesibles, resilientes y coherentes sin cambiar el diseño base.

- Archivos: páginas, CrudPage, CSS, navegación.
- Componentes: validación por campo, loading/empty states, confirmaciones, guardado de borrador, breadcrumbs/autocomplete.
- Pruebas: componentes, teclado, accesibilidad, viewport móvil y pérdida de formulario.
- Aceptación: acciones no se duplican, errores conservan datos y menú refleja permisos reales.

## Fase 12 — Pruebas y preparación para producción

**Objetivo:** demostrar operabilidad segura.

- Crear `CAMBIOS_REALIZADOS.md`, `PRUEBAS_REALIZADAS.md`, `DESPLIEGUE_PRODUCCION.md`, runbooks de backup/restauración y riesgos pendientes.
- CI: lint/build/test/API/E2E, migración, análisis de dependencias y artefactos.
- Infra: HTTPS, CORS exacto, TLS DB, CSP, logs/rotación, health, alertas, PITR/backups y restauración ensayada.
- Datos: admin inicial seguro, demo separado, retención/borrado legal, Storage privado.
- Aceptación: staging pasa criterios; cero hallazgos críticos/altos abiertos sin aceptación formal; rollback y restauración medidos.

## Primera fase recomendada para aprobación

Ejecutar conjuntamente **Fase 1 + el bloque mínimo de Fase 2 relativo a logs/mensajes/bloqueo**, porque reduce riesgo sin alterar todavía los módulos clínicos y financieros. Entregables: migración incremental, suite de autenticación/API, configuración reproducible y reporte de resultados.
