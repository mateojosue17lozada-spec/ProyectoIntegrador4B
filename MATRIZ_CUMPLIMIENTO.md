# Matriz de cumplimiento — 44 requisitos

**Corte:** 15 de julio de 2026. Estados basados en evidencia verificable del repositorio; una pantalla o tabla por sí sola no equivale a cumplimiento integral.

| ID | Requisito | Estado | Evidencia | Problema encontrado | Prioridad | Archivos relacionados | Solución propuesta |
|---:|---|---|---|---|---|---|---|
| 1 | Login individual | Cumple parcialmente | Usuario/correo único, bcrypt, JWT/sesión y respuesta genérica | Falta prueba real de API/DB aislada | Alto | `auth.service.js`, controlador | Ejecutar integración de credenciales correctas/incorrectas |
| 2 | Recuperación segura | Cumple parcialmente | Hash, expiración, uso único, activo y revocación; correo fake en test | Casos real/vencido/reuso aún sin integración | Alto | auth, email | Suite DB aislada del ciclo completo |
| 3 | Bloqueo tras tres intentos | Cumple parcialmente | Migración, fecha, duración configurable e incremento SQL atómico | Concurrencia real no probada aún | Alto | auth, migración | Aplicar en test y ejecutar intentos simultáneos |
| 4 | Roles y permisos | Cumple parcialmente | Contrato estático de cuatro roles aprobado | Listas dispersas y falta contrato HTTP permitido/denegado | Alto | middleware/rutas/Layout | Integración por rol/acción y fuente única futura |
| 5 | Logout/sesiones | Cumple parcialmente | Revoca `jti`, limpia storage y ya no loguea previews | Sin inactividad/cookie HttpOnly ni integración JWT/logout | Alto | auth middleware/context | Pruebas JWT válido/vencido/revocado/logout |
| 6 | Auditoría | Cumple parcialmente | Eventos de login categorizados y desbloqueo con motivo sanitizado | Sigue best effort; no before/after/rol/resultado universal | Alto | audit/auth/logger | Auditoría transaccional completa en fase posterior |
| 7 | Contraseñas/datos sensibles | Cumple parcialmente | bcrypt, logger con redacción, sin previews JWT, test sin correo | JWT permanece en localStorage y TLS DB admite CA no verificada | Alto | logger/auth/database/web | Integración de no filtración, CSP/cookie y TLS verificado |
| 8 | Datos personales/perfil | Cumple parcialmente | Endpoint/perfil web y edición limitada | Falta estado visible, cambio de contraseña autenticado e historial | Medio | auth profile, `Dashboard.jsx` | Completar campos/validaciones y actividad según permiso |
| 9 | Citas | Cumple parcialmente | Crear, estados, conflicto simple, filtros UI básicos | Sin reprogramación sólida, transición, duración ni motivo obligatorio | Alto | citas service/page | Máquina de estados, conflicto por profesional/rango y pruebas |
| 10 | Pago previo obligatorio | Cumple parcialmente | Pago transaccional y trigger antes de historia | Sin anulación, comprobante, saldo/aplicación/idempotencia | Alto | citas, `pagos_previos` | Ledger de anticipos y aplicación a factura |
| 11 | Anamnesis | Cumple parcialmente | Sección en JSON clínico cifrado | Estructura/validación clínica limitada | Medio | historia service/page | Esquema validado y revisión profesional |
| 12 | Lensometría | Cumple parcialmente | Sección/formulario existente | Persistencia como JSON agrupado, búsquedas difíciles | Medio | historia, Lensometria | Campos estructurados por ojo o JSON validado/indexable |
| 13 | Agudeza visual | Cumple parcialmente | Sección y página | Sin evidencia completa de escala/distancia/ambos ojos | Medio | historia, AgudezaVisual | Definir modelo clínico y pruebas de persistencia/impresión |
| 14 | Examen externo | Cumple parcialmente | Servicio de exámenes, historia y UI; prueba DB indirecta | No existe prueba de regresión específica del payload/edición | Alto | examenes, ExamenExterno | Prueba API de crear/leer/editar/imprimir |
| 15 | Reflejos pupilares | Cumple parcialmente | Campo clínico existente | No probado en edición/impresión/asociación | Medio | historia | Tests de contrato y documento |
| 16 | Oftalmoscopía | Cumple parcialmente | Página y sección | Estructura/valores normales no acreditados | Medio | historia, Oftalmoscopia | Validación por ojo y revisión profesional |
| 17 | Diagnóstico CIE-10 | Cumple parcialmente | Catálogo local y búsqueda | Solo código principal en historia; no M:N secundarios | Alto | historia, migración hardening | Tabla puente, principal/secundarios, observación y tests |
| 18 | Examen motor | Cumple parcialmente | Sección existente | Alcance clínico no validado ni estructurado | Medio | historia | Modelo extensible aprobado por responsable clínico |
| 19 | Observaciones patológicas | Cumple parcialmente | Campo en contenido cifrado | Sin entidad estructurada, prioridad/seguimiento/auditoría | Medio | historia | Estructurar hallazgos y seguimiento |
| 20 | Tratamiento | Cumple parcialmente | Campo en historia | Sin frecuencia/duración/relación diagnóstico estructurada | Medio | historia | Modelo y validaciones clínicas |
| 21 | Recetas e impresión | Cumple parcialmente | CRUD, vínculo e impresión marcada | Automatización/PDF/reimpresión e historial no completos | Alto | recetas service/page | Generar desde historia final, PDF estable y control de versiones |
| 22 | Bloqueo legal 24 h | Cumple parcialmente | Trigger DB y `editable_hasta` | Cuenta desde creación, no finalización; sin adendas/estados | Alto | historia, `tablas.sql` | Máquina de estados, `finalizada_en`, adendas y reloj probado |
| 23 | Pedidos de laboratorio | Cumple parcialmente | Tablas, rutas y estados básicos | Estados/transiciones sugeridas e historial incompletos | Medio | recetas/pedidos | Historial de estado y transición validada |
| 24 | Ensamblaje | Cumple parcialmente | Campos en pedido | No flujo completo de técnico, QC, incidencias y entrega | Medio | recetas, esquema | Entidad/flujo de ensamblaje y pruebas |
| 25 | Facturación interna | Cumple parcialmente | Totales backend, transacción, caja y stock | Impuesto libre, número temporal, sin SRI | Alto | factura service | Secuencia, reglas fiscales y definir integración SRI |
| 26 | Vínculo factura/receta/historia | Cumple | Validación paciente-receta-historia en backend | Falta prueba automatizada específica | Medio | factura service | Añadir prueba de vínculo válido/inválido |
| 27 | Formas de pago | Cumple parcialmente | Cinco formas y múltiples líneas | Mixto puede ser etiqueta; suma no debe coincidir si crea saldo | Alto | factura service | Separar contado/crédito y conciliar líneas exactamente |
| 28 | Caja diaria | Cumple parcialmente | Apertura/cierre/historial persistentes | Sin transacción/lock, turno/caja, movimientos ni observación obligatoria | Alto | caja service | Modelo de caja/turno, arqueo por forma y prueba concurrente |
| 29 | Notas/anulaciones/devoluciones | Cumple parcialmente | Transacciones y documentos relacionados | Devolución parcial repone todos los ítems; duplicados posibles | Alto | factura service | Detalle por ítem/cantidad, idempotencia y reversión financiera |
| 30 | Descuentos/promociones | Cumple parcialmente | Promoción y permiso admin backend | Sin vigencias, alcance por producto, límites ni motivo | Medio | factura service/esquema | Modelo completo y auditoría de autorización |
| 31 | Proveedores | Cumple parcialmente | CRUD y datos básicos | Eliminación física; campos comerciales incompletos | Medio | compras service | Desactivación y ampliar condiciones/crédito/documentos |
| 32 | Órdenes de compra | Cumple parcialmente | Cabecera/detalle/transacción | Sin aprobación robusta, impuestos/condiciones/historial | Medio | compras service | Estados, autorización e historial |
| 33 | Recepción | Cumple parcialmente | Transacción, lock, stock/costo/CxP | Solo recepción total; sin lotes ni movimiento de inventario explícito | Alto | compras service | Recepciones parciales/idempotentes y ledger |
| 34 | Costos y márgenes | Cumple parcialmente | Costo promedio y margen calculado | Sin costos adicionales/historial; costo del producto se sobrescribe | Medio | compras/inventario | Historial de costos y snapshot en documentos |
| 35 | Inventario multivariante | Cumple parcialmente | Esfera/cilindro/eje/material en producto | No producto-variante; faltan adición/índice/diámetro/lab | Alto | inventario/esquema | Modelo producto-variante incremental |
| 36 | Categorías | Cumple parcialmente | Categorías CRUD | Sin subcategorías/estado; eliminación física | Medio | inventario | Jerarquía y baja lógica |
| 37 | Código de barras | Cumple parcialmente | Unicidad/esquema y búsqueda exacta/manual | Sin prueba de lector/foco/feedback/etiqueta | Medio | inventario page/service | Componente scanner-keyboard y prueba |
| 38 | Stock mínimo | Cumple parcialmente | Stock mínimo y filtro | Sin reservado/disponible/sucursal/gestión de alertas | Medio | inventario | Reservas y alerta deduplicada |
| 39 | Trazabilidad de laboratorios | Cumple parcialmente | Receta/pedido/productos relacionados parcialmente | No trazabilidad verificable completa inventario→entrega | Medio | recetas/inventario | Identificadores y eventos de estado enlazados |
| 40 | Ajustes/usabilidad con muchos productos | Cumple parcialmente | Ajuste transaccional con lock y búsqueda | Sin paginación; movimiento no guarda anterior/resultante/aprobación | Alto | inventario | Ledger inmutable, tipos, paginación y autocomplete |
| 41 | Cuentas por cobrar | Cumple parcialmente | Cuenta, saldo, abonos y lock | Comprobante/forma/usuario incompletos; mutación durante GET | Alto | cartera | Ledger de abonos y proceso de vencimiento separado |
| 42 | Cuentas por pagar | Cumple parcialmente | Cuenta, vencimiento, pagos y lock | Calendario/alerta/comprobante/forma incompletos | Medio | cartera | Completar modelo y filtros |
| 43 | Antigüedad de saldos | No cumple | CASE básico sobre fecha actual | Sin por vencer, fecha de corte, filtros, totales ni exportación | Alto | cartera service/page | Reporte parametrizado real y pruebas de fronteras |
| 44 | Bloqueo de crédito vencido | Cumple parcialmente | Factura bloquea crédito si hay vencidas | Política no configurable; sin excepción autorizada/auditoría | Alto | factura/cartera | Política, override administrativo y evento auditable |

## Requisitos transversales no incluidos en el conteo

- Pruebas obligatorias: **No cumple**; solo 5 pruebas de esquema/invariantes.
- Producción/backups/restauración/health check: **No implementado o no verificable**.
- Aplicación móvil funcional: **No implementado**.
- Facturación electrónica ecuatoriana: **No implementado** por falta de integración/certificados externos.
