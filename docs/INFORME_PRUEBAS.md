# Informe de pruebas funcionales — ProyectoIntegrador4B

**Fecha:** 6 de septiembre de 2026
**Entorno:** backend Node.js local (puerto 3010) contra PostgreSQL 16 en Docker
**Alcance ejecutado:** 99 casos de prueba sobre la API real
**Resultado:** 81 PASAN / 18 FALLAN — **11 fallos de severidad Crítica**

---

## 1. Entorno de pruebas

La base de Supabase sigue **pausada** (`XX000 EAUTHQUERY: connection to database
not available`) y no hay acceso para reanudarla. Como la instrucción era
priorizar una conexión real, se levantó un entorno equivalente:

```
PostgreSQL 16.15 en Docker (puerto 55432)
  ├── database/tablas.sql
  ├── supabase/migrations/*.sql   (8 migraciones)
  └── backend/src/scripts/seedDemo.js
```

**No se modificó ningún archivo del código de la aplicación.** Sí hubo que
parchear el *esquema* para que el sistema arrancara — y cada parche es en sí
mismo una incidencia (INC-01 a INC-05). El script `reset.sh` los reproduce.

Las manipulaciones de datos hechas para poder probar (envejecer una historia
clínica, mover turnos de caja a la fecha anterior, desbloquear un usuario) están
marcadas en el código de la suite.

---

## 2. Resumen por módulo

| Módulo | Pasa | Falla | Estado |
|---|---:|---:|---|
| Seguridad | 12 | 0 | ✅ |
| Mantenimiento | 7 | 0 | ✅ |
| Permisos por rol | 10 | 0 | ✅ |
| Citas | 10 | 0 | ✅ |
| Inventario | 5 | 0 | ✅ |
| Cartera | 4 | 0 | ✅ |
| Facturación | 7 | 1 | ⚠️ |
| Historia clínica | 8 | 4 | ⚠️ |
| Caja | 6 | 1 | ⚠️ |
| **Caja (requisito Diana)** | 2 | 4 | ❌ |
| Compras | 2 | 2 | ❌ |
| Flujo integrado | 4 | 1 | ⚠️ |
| Innovación (probador) | 2 | 0 | ✅ |
| Reportes | 2 | 5 | ❌ |

---

## 3. Los dos requerimientos de Diana

### 3.1 Cierre de caja — PARCIALMENTE IMPLEMENTADO (2 de 6)

| Campo pedido | Estado | Evidencia |
|---|---|---|
| Total por tipo de pago | ❌ NO | Solo existe `ventas_efectivo`. En el turno de prueba hubo Efectivo=55.00, Tarjeta=65.00, Transferencia=24.00; el cierre guardó únicamente 55.00 |
| Total general | ⚠️ PARCIAL | `efectivo_esperado` solo cuenta efectivo, no el total del turno |
| Efectivo para vueltos | ❌ NO | No existe columna |
| Efectivo retirado al banco | ❌ NO | No existe columna |
| Observaciones del cajero | ✅ SÍ | `caja_turnos.observaciones` |
| Responsable | ✅ SÍ | `id_cajero` + registro en `auditoria` |

Columnas actuales de `caja_turnos`: `id_caja_turno, id_cajero, fecha,
monto_apertura, monto_cierre, estado, abierto_en, cerrado_en, ventas_efectivo,
efectivo_esperado, diferencia, observaciones`.

Se enviaron `efectivo_para_vueltos`, `efectivo_retirado_banco`, `total_tarjeta` y
`total_transferencia` en el cuerpo del cierre: el backend los **ignora sin avisar**
(HTTP 200 y ningún dato guardado).

### 3.2 Bloqueo de anamnesis — PARCIALMENTE IMPLEMENTADO (2 de 5)

| Requisito | Estado | Evidencia |
|---|---|---|
| Bloqueo tras 24 h | ✅ SÍ | `editable_hasta = NOW() + 24h` al finalizar; trigger `historias_bloqueo_legal` impide el UPDATE |
| Los datos quedan intactos | ✅ SÍ | Se envejeció la historia y se intentó editar: contenido sin cambios |
| Observación obligatoria en cada edición | ❌ NO | Editar dentro de las 24 h sin motivo → **HTTP 200**. No existe columna `motivo_edicion` |
| Autorización del administrador | ❌ NO | `/historia/:id/solicitar-autorizacion` y `/historia/:id/autorizar` → **HTTP 404** |
| Historial de cambios | ⚠️ PARCIAL | Existen adendas (append-only). La auditoría registra `HISTORIA_ACTUALIZADA` pero **sin el detalle de qué cambió** |

**Matiz importante:** el bloqueo lo impone un **trigger de PostgreSQL**, no el
código. `historia.service.js:122 exports.actualizar` no comprueba `bloqueada` ni
`editable_hasta`; su `WHERE` es solo `id_historia=$8`. Funciona, pero con dos
consecuencias: si alguien despliega el esquema sin ese trigger la protección
desaparece, y el error llega al usuario como **HTTP 500 "Ocurrió un error
interno"** en lugar del mensaje real, que sí es bueno: *"La historia clínica está
bloqueada y no puede modificarse. Utilice adendas."*

---

## 4. Incidencias

### Críticas

**INC-01 — Recibir una orden de compra falla siempre**
`compras.service.js:27`. PostgreSQL infiere `$1` como `integer` por `stock+$1`, y
eso arrastra `$2` al mismo tipo; pero `costo_unitario` es `NUMERIC` y llega como
`"20.00"`.
```
ERROR: invalid input syntax for type integer: "20.00"
STATEMENT: UPDATE productos SET costo=CASE WHEN stock+$1>0
           THEN ((stock*costo)+($1*$2))/(stock+$1) ELSE $2 END, stock=stock+$1
```
Rompe la cadena compras → inventario → cuentas por pagar. Reproducir: crear orden
con costo decimal y recibirla → HTTP 400. Arreglo: castear explícitamente
(`$1::numeric`, `$2::numeric`).

**INC-02 — Convertir un pedido web en factura falla siempre**
`inventario.service.js:375` hace `require("../factura/factura.service")`, pero la
carpeta se llama `facturacion`. `POST /inventario/pedido/:id/convertir` → HTTP 500
`Cannot find module`. Rompe el flujo completo de venta web.

**INC-03 — El rol "Paciente" no existe y está prohibido por un CHECK**
`database/tablas.sql:6` restringe `nombre_rol` a cuatro valores y excluye
`Paciente`. Ni `datos.sql` ni `seedDemo.js` lo crean. Pero 8 rutas lo exigen
(`/citas/mis-citas`, `/inventario/pedido`, `/facturacion/mis-pedidos`…), el
frontend web tiene carrito de paciente y la app móvil tiene una experiencia
completa de paciente. **En un despliegue limpio, ningún paciente puede usar el
sistema.**

**INC-04 — Deriva de esquema: el código usa columnas que el DDL no crea**
- `facturas.es_simulada` (`factura.service.js:154`) → facturar da HTTP 500
- `devoluciones.forma_pago` (`caja.service.js:55`) → cerrar caja da HTTP 500

Ninguna aparece en `database/tablas.sql` ni en las migraciones. El repositorio
**no puede producir un sistema funcional**; la base de Supabase tiene columnas
que nadie versionó.

**INC-05 — Tablas sin DDL en el repositorio**
`pedidos_pendientes`, `pedido_detalle`, `password_reset_tokens` y `tabla_prueba`
se usan en el código (y `seedDemo.js` trunca las dos últimas) pero no existen en
ningún `.sql`. `seedDemo.js` falla contra un esquema recién creado.

**INC-06 — El arqueo mezcla el efectivo de todos los cajeros del día**
`caja.service.js:51-56`. Los abonos y devoluciones en efectivo se suman con
`creado_en::date = CURRENT_DATE`, sin filtrar por `id_caja_turno`. Con dos
cajeros el mismo día, el arqueo de cada uno incluye el efectivo del otro y la
diferencia sale mal. Las ventas sí se filtran por turno; la inconsistencia está
en abonos y devoluciones.

**INC-07 — La edición de anamnesis no exige motivo** (Diana 2)
Editar dentro de la ventana de 24 h sin justificación → HTTP 200.

**INC-08 — No existe el flujo de autorización del administrador** (Diana 2)
No hay endpoint ni columna. El médico que necesita corregir pasadas 24 h solo
puede añadir una adenda.

**INC-09 — El cierre de caja no desglosa por forma de pago** (Diana 1)

**INC-10 — Faltan los campos de vueltos y retiro a banco** (Diana 1)

**INC-11 — El Cajero puede leer historias clínicas completas**
`historia.routes.js:11` incluye `"Cajero"` en `GET /historia/:id`, que devuelve la
anamnesis descifrada. Verificado: Cajero → HTTP 200, Vendedor → HTTP 403.
Información clínica sensible accesible a un rol administrativo.

### Mayores

**INC-12 — El módulo de reportes no existe.** `/api/reportes*` → 404. No hay
carpeta `modules/reportes`. Solo existen sustitutos parciales:
`/facturacion/resumen-dia` y `/caja/historial`.

**INC-13 — Una regla de negocio se reporta como error interno.** El trigger de
bloqueo emite un mensaje claro, pero `utils/http.js:14` lo convierte en HTTP 500
"Ocurrió un error interno" porque no reconoce el código `P0001` de `RAISE
EXCEPTION`.

**INC-14 — El historial de cambios no guarda qué cambió.** La auditoría registra
la acción, no el contenido anterior ni el nuevo.

### Menores

**INC-15 — Reponer stock en una devolución es opcional.** `factura.service.js:272`
solo repone si llega `reponer_stock === true`. Una devolución normal pierde el
inventario en silencio; el valor por defecto debería ser el contrario.

---

## 5. Lo que sí funciona bien

**Seguridad (12/12).** Bloqueo tras 3 intentos, rechazo del login correcto
estando bloqueado, token invalidado tras logout, token manipulado rechazado,
rate limiting activo, recuperación que no revela si el correo existe.

**Permisos (10/10).** Los 10 cruces rol/ruta se comportan como corresponde.

**Citas (10/10).** Todas las validaciones responden: fecha pasada rechazada,
horario ocupado rechazado, reagendar al pasado rechazado, cancelar dos veces
rechazado.

**Inventario y cartera (9/9).** Ajuste que dejaría stock negativo rechazado,
alerta de stock mínimo, abono superior al saldo rechazado, crédito bloqueado por
vencidos.

**Probador virtual (2/2).** El pedido web guarda `prueba_virtual_data` y el
cajero la recupera por su endpoint.

---

## 6. Cumplimiento de la lista de cotejo

| Punto | Estado | Justificación |
|---|---|---|
| 2. Acceso y seguridad | ✅ Cumple | 12/12 |
| 3. Mantenimiento | ✅ Cumple | 7/7 |
| 4. Citas | ✅ Cumple | 10/10 |
| 4. Pacientes e historia clínica | ⚠️ Parcial | Bloqueo 24 h sí; motivo y autorización no |
| 4. Ventas y facturación | ⚠️ Parcial | Funciona tras parchear `es_simulada` |
| 4. Compras | ❌ No cumple | INC-01 impide recibir órdenes |
| 4. Inventario | ✅ Cumple | 5/5 |
| 4. Cartera | ✅ Cumple | 4/4 |
| 5. Reportes | ❌ No cumple | Módulo inexistente |
| 5. Innovación | ✅ Cumple | Probador operativo en web y móvil |

---

## 7. Recomendaciones, por orden

1. **Versionar el esquema completo.** INC-03/04/05 son la misma enfermedad: la
   base viva y el repositorio divergieron. Volcar el esquema real de Supabase a
   una migración y verificar en CI que `tablas.sql` + migraciones + `seedDemo`
   levantan un sistema que arranca.
2. **Corregir INC-01 y INC-02.** Son dos líneas y desbloquean compras y venta web.
3. **Completar el cierre de caja de Diana.** Añadir a `caja_turnos`:
   `total_tarjeta`, `total_transferencia`, `total_credito`, `total_general`,
   `efectivo_vueltos`, `efectivo_retirado_banco`; y de paso arreglar INC-06.
4. **Completar el bloqueo de anamnesis.** Columna `motivo_edicion` obligatoria,
   tabla `historia_ediciones` con antes/después, y endpoints de solicitud y
   autorización con rol Administrador.
5. **Quitar `Cajero` de `GET /historia/:id`** (INC-11).
6. **Mapear `P0001` a HTTP 409** en `utils/http.js` para que las reglas de
   negocio del trigger lleguen con su mensaje.
7. **Construir el módulo de reportes**, o acordar explícitamente que los
   sustitutos existentes cubren el punto 5 de la lista.

---

## 8. Cobertura no ejecutada

- **Frontend web y app móvil en navegador/dispositivo**: solo se probó la capa
  API. Los flujos de UI (probador virtual con foto real, navegación por tabs,
  impresión de recetas y certificados) quedan pendientes de prueba manual.
- **Recuperación de contraseña de extremo a extremo**: se verificó que el token
  se genera y que uno inválido se rechaza; no se comprobó la entrega del correo.
- **Notificaciones push**: no implementadas en el backend.

---

## 9. Cómo reproducir

```bash
# 1. Levantar la base
docker run -d --name optica-test -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=optica_test -p 55432:5432 postgres:16-alpine

# 2. Esquema + parches + datos  (reset.sh del scratchpad de la sesión)
./reset.sh

# 3. Backend
cd backend && DATABASE_URL=postgresql://postgres:test123@localhost:55432/optica_test \
  JWT_SECRET=clave_de_pruebas DB_SSL=false PORT=3010 node src/server.js

# 4. Suites
node suite.js    # seguridad, permisos, citas
node suite2.js   # historia clínica
node suite3.js   # caja, facturación, compras, inventario, cartera, flujos
```
