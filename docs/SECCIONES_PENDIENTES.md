# Secciones pendientes (lista de cotejo + Diana) — implementación

Todo lo de backend se probó **end-to-end contra la Supabase real** y se limpiaron
los datos de prueba. Build y lint del frontend en verde. 23/23 tests de backend
siguen pasando.

## 1. Cierre de caja completo (Diana) — ✅ HECHO

**Backend** `caja.service.js`:
- Nueva función `calcularArqueo`: totales **por tipo de pago** (efectivo,
  tarjeta, transferencia, crédito) desde `factura_pagos`, filtrados por
  `id_caja_turno`.
- `cerrar` guarda `total_efectivo/tarjeta/transferencia/credito`, `retiro_banco`
  y `responsable`; **deriva** el efectivo que se queda para vueltos
  (`fondo_vueltos = contado − retiro`) y valida:
  - retiro ≤ contado;
  - si el cajero declara el fondo, `fondo + retiro = contado`.
- Nueva ruta `GET /caja/resumen` para previsualizar el arqueo del turno abierto.

**Frontend** `Caja.jsx`: muestra el desglose por tipo de pago y el efectivo
esperado; añade los campos **retiro/depósito al banco**, **responsable** y el
**fondo de vueltos** (calculado, solo lectura); nuevas columnas en el historial.

> Nota: no existe columna de "fondo/vueltos" en la BD — se deriva y se muestra;
> lo que se persiste es `retiro_banco` (el resto = fondo).

## 2. Arqueo de caja — corrección de filtro (Diana) — ✅ HECHO

Antes los abonos y devoluciones en efectivo se sumaban por `CURRENT_DATE`,
mezclando el efectivo de todos los cajeros del día. Ahora `calcularArqueo` las
filtra por la **ventana temporal del turno** (`abierto_en … ahora`). Las ventas
ya se filtraban por `id_caja_turno`.

> Límite real: `abonos_cxc` y `devoluciones` no guardan cajero ni turno, así que
> la ventana del turno es la atribución más precisa posible sin cambiar su
> esquema. Si dos cajeros solapan turnos, un abono podría contarse en ambos; la
> solución definitiva sería añadir `id_caja_turno` a esas tablas.

## 3. Módulo de Reportes — ✅ HECHO (nuevo)

**Backend** `modules/reportes/` (registrado en `routes.js` como `/api/reportes`):
- `GET /reportes/citas?fecha_inicio&fecha_fin&medico&estado`
- `GET /reportes/ventas?fecha_inicio&fecha_fin&tipo_pago` (+ resumen por forma de pago)
- `GET /reportes/compras?fecha_inicio&fecha_fin&proveedor`
- `GET /reportes/inventario?categoria&stock_minimo`
- `GET /reportes/cierre-caja?fecha&cajero` (incluye todos los campos del arqueo)

Consultas de solo lectura, parametrizadas (sin inyección), con `LIMIT 500`.

**Frontend** `pages/reportes/Reportes.jsx` + ruta en `App.jsx` + ítem "Reportes"
en el menú (`Layout.jsx`): selector de reporte, filtros dinámicos, tabla y
**exportación a CSV** (cliente, sin dependencias).

## 4. Bloqueo de anamnesis: motivo + autorización (Diana) — ✅ HECHO

**Backend** `historia.service.js`:
- `actualizar` exige **`observacion`** (motivo) al editar una historia
  finalizada, y registra cada cambio en la nueva tabla **`historia_ediciones`**.
- Nueva `POST /historia/:id/desbloquear` (**solo Administrador**): reabre 2 h una
  historia bloqueada, exige motivo, queda auditada y registrada.
- Nueva `GET /historia/:id/ediciones`: historial de cambios.
- El error del trigger de bloqueo (`P0001`) ahora se traduce a **HTTP 409 con
  mensaje claro** (antes "error interno") en `utils/http.js`.
- El trigger `impedir_edicion_historia_bloqueada` se actualizó para permitir un
  **bypass explícito y auditado** solo dentro de la transacción de desbloqueo
  (variable de sesión `app.bypass_bloqueo_historia`).

**Frontend** `HistoriaClinica.jsx`: campo "Motivo de la edición" al editar; botón
**Desbloquear** en historias cerradas (solo Administrador, pide el motivo).

**Verificado en vivo**: editar vencida → 409 claro; admin desbloquear → 200;
editar con motivo → 200; sin motivo → 400; historial con 2 registros; desbloquear
sin motivo → 400; desbloquear por no-admin → 403.

## 5. App móvil — ✅ YA EXISTE

Se creó en una tarea anterior: `mobile-app/` (Expo SDK 52 + TypeScript, tabs por
rol, auth, citas, catálogo, carrito, perfil, caja, probador). Ver
`docs/APP_MOVIL.md`. Cumple el punto de "accesible desde dispositivos móviles".

## 6. Probador virtual — ⚠️ PENDIENTE DE PRUEBA CON CÁMARA

Implementado y corregido (tiempo real con MediaPipe, espejo por `facingMode`,
anclaje al puente de la nariz, transparencia real, arrastre, carrito). Ver
`docs/PROBADOR_VIRTUAL.md`. **No se pudo probar con cámara real en este entorno**
(sin webcam). Queda validación manual en `localhost:5173`.

## 7. Innovación — ✅ DOCUMENTADA

El probador virtual es la innovación (realidad aumentada básica): sigue el rostro
en vivo, superpone la montura y **añade al carrito** la prueba (con
consentimiento). La integración con el carrito está verificada por API.

## Migraciones nuevas (corrigen deriva de esquema)

- `20260906140000_cierre_caja_y_ediciones_historia.sql`: columnas de arqueo en
  `caja_turnos` (IF NOT EXISTS), tabla `historia_ediciones`, y el trigger con
  bypass autorizado. **Ya aplicada a Supabase.**

## Pruebas sugeridas

1. **Caja** (como Cajero): abrir → facturar en efectivo, tarjeta y transferencia
   → cerrar; verifica el desglose, el retiro al banco, el responsable y el fondo.
2. **Reportes** (como Administrador): cada reporte con filtros de fecha; exporta
   un CSV y ábrelo.
3. **Anamnesis** (Optómetra + Administrador): finaliza una historia; pasadas 24 h
   (o forzando `editable_hasta`) intenta editar → bloqueada; el Administrador la
   desbloquea con motivo; edita con motivo; revisa el historial de ediciones.
