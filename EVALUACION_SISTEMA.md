# Informe de Evaluación y Auditoría del Sistema: Óptica Integral

**Fecha de evaluación:** 7 de septiembre de 2026  
**Proyecto:** Sistema de Gestión Optométrica e Inventario — Óptica Integral  
**Repositorio:** ProyectoIntegrador4B  

---

## 📊 Resumen Ejecutivo de Cumplimiento

| Categoría | Estado General | Cumplimiento |
| :--- | :---: | :---: |
| **1. Seguridad y Autenticación** | ✅ Cumple | 100% |
| **2. Módulo de Mantenimiento** | ✅ Cumple | 100% |
| **3. Reglas de Negocio (Clínica, Citas y Ventas)** | ✅ Cumple | 100% |
| **4. Reportes y Analítica** | ✅ Cumple | 100% |
| **5. Innovación en el Desarrollo** | ✅ Cumple (Sobresaliente) | 100% |

---

## 1. 🔐 Seguridad y Autenticación

| Requisito | Estado | Evidencia Técnica en el Código |
| :--- | :---: | :--- |
| **El sistema permite inicio de sesión seguro** | **CUMPLE** | Implementado en [`backend/src/modules/auth/auth.service.js`](backend/src/modules/auth/auth.service.js) con hash de contraseñas **BCrypt (factor 10)**, generación de tokens **JWT con identificador criptográfico único (`jti`)**, sesiones persistidas en la tabla `sesiones_usuario` con revocación en servidor y cookies `HttpOnly; SameSite=Lax; Secure`. |
| **Los usuarios solo acceden a funciones según su rol** | **CUMPLE** | Control de acceso basado en roles (RBAC) con [`backend/src/middleware/rol.middleware.js`](backend/src/middleware/rol.middleware.js) en el backend y `PrivateRoute` en [`frontend-web/src/App.jsx`](frontend-web/src/App.jsx). Cada endpoint verifica el array de roles autorizados (`Administrador`, `Optometra`, `Cajero`, `Vendedor`, `Paciente`). |
| **El acceso a funcionalidades está correctamente restringido** | **CUMPLE** | Las rutas de facturación, caja, compras, usuarios y configuración clínica están protegidas a nivel de middleware HTTP. El intento de consumo por un rol no autorizado retorna de inmediato `403 Forbidden`. |
| **El sistema maneja errores de autenticación adecuadamente** | **CUMPLE** | **Anti-enumeración de usuarios:** Tanto credencial errónea como usuario inexistente retornan un mensaje genérico: *"Usuario o contraseña incorrectos"*. **Bloqueo contra fuerza bruta:** Al tercer intento fallido consecutivo (`intentos_fallidos >= 3`), la cuenta se bloquea automáticamente por 15 minutos (`bloqueado=TRUE`) registrando la auditoría. |
| **No se permite acceso no autorizado a información sensible** | **CUMPLE** | Los expedientes médicos y anamnesis cuentan con **cifrado simétrico AES-256-GCM** antes de guardarse en la base de datos (`cifrarContenido` en [`backend/src/modules/historiaClinica/historia.service.js`](backend/src/modules/historiaClinica/historia.service.js)). Los tokens de recuperación de clave usan hashing SHA-256 y vencen a los 30 minutos. |

---

## 2. 🛠️ Módulo de Mantenimiento

| Requisito | Estado | Evidencia Técnica en el Código |
| :--- | :---: | :--- |
| **Desplazarse por menús diferenciando perfiles** | **CUMPLE** | En [`frontend-web/src/components/Menu.jsx`](frontend-web/src/components/Menu.jsx) y [`frontend-web/src/components/Layout.jsx`](frontend-web/src/components/Layout.jsx), la barra de navegación lateral y los accesos se reconstruyen dinámicamente según el rol: el Optómetra ve Historia Clínica/Exámenes/Recetas, el Cajero ve Facturación/Caja/Cuentas por Cobrar, el Vendedor ve Inventario/Catálogo y el Administrador tiene visión global. |
| **Administración completa de usuarios, roles y permisos** | **CUMPLE** | Módulo de [`frontend-web/src/pages/usuarios/Usuarios.jsx`](frontend-web/src/pages/usuarios/Usuarios.jsx) para alta, edición, bloqueo/desbloqueo y asignación de roles. Módulo [`frontend-web/src/pages/roles/RolesPermisos.jsx`](frontend-web/src/pages/roles/RolesPermisos.jsx) con **matriz interactiva de checkboxes por rol/módulo** conectada al backend (`/api/roles-permisos/guardar`). |

---

## 3. 💼 Reglas de Negocio

| Requisito | Estado | Evidencia Técnica en el Código |
| :--- | :---: | :--- |
| **Clientes reservan citas fácilmente** | **CUMPLE** | Interfaz simplificada con selector de especialista, calendario interactivo y bloques de horarios en la Web ([`frontend-web/src/pages/citas/Citas.jsx`](frontend-web/src/pages/citas/Citas.jsx)) y en la App Móvil ([`frontend-movil/app/(tabs)/citas.tsx`](frontend-movil/app/(tabs)/citas.tsx)). |
| **Citas pueden modificarse y cancelarse** | **CUMPLE** | Flujo completo de **Reagendar** (selección de nueva fecha/hora) y **Cancelar** con registro de motivo de cancelación en la tabla `citas`. |
| **Valida disponibilidad antes de confirmar citas** | **CUMPLE** | Endpoint `GET /api/citas/disponibilidad?id_usuario=X&fecha_cita=Y` en [`backend/src/modules/citas/citas.routes.js`](backend/src/modules/citas/citas.routes.js). La interfaz consulta y bloquea visualmente los horarios ocupados. |
| **Evita cruce de horarios automáticamente** | **CUMPLE** | Regla transaccional estricta en [`backend/src/modules/citas/citas.service.js`](backend/src/modules/citas/citas.service.js): si ya existe una cita en el mismo horario con el mismo profesional (que no esté cancelada), rechaza la petición con error `409 Conflict: Ya existe una cita en ese horario`. |
| **Clientes/pacientes visualizan su agenda** | **CUMPLE** | Pantalla dedicada "Mis Citas" con filtros por pestañas (`Todas`, `Pendientes`, `Confirmadas`, `Canceladas`, `Historial`) y contadores de citas en vivo. |
| **Agenda accesible desde dispositivos móviles** | **CUMPLE** | Aplicación móvil nativa en React Native / Expo ([`frontend-movil`](frontend-movil)) conectada a producción mediante HTTPS con soporte completo de visualización y acciones. |
| **Admisión registra la información del paciente** | **CUMPLE** | Pantalla [`frontend-web/src/pages/pacientes/Pacientes.jsx`](frontend-web/src/pages/pacientes/Pacientes.jsx) con cédula ecuatoriana, nombres, fecha de nacimiento, contacto, dirección, ocupación, procedencia y antecedentes. |
| **Médico registra anamnesis e historia clínica** | **CUMPLE** | Módulo clínico en 10 etapas en [`frontend-web/src/pages/historia/HistoriaClinica.jsx`](frontend-web/src/pages/historia/HistoriaClinica.jsx): datos generales, anamnesis, lensometría, agudeza visual, examen externo, reflejos pupilares, oftalmoscopía, examen motor, refracción, diagnóstico CIE-10 y tratamiento. |
| **Impresión de recetas y certificados** | **CUMPLE** | En [`frontend-web/src/pages/recetas/Recetas.jsx`](frontend-web/src/pages/recetas/Recetas.jsx), botón "Imprimir" genera el documento formal de receta optométrica (OD/OI, esfera, cilindro, eje, adición, DNP, observaciones y pie de firma del optómetra). En [`frontend-web/src/pages/historia/HistoriaClinica.jsx`](frontend-web/src/pages/historia/HistoriaClinica.jsx), impresión directa del expediente/certificado clínico. |
| **Emite ventas, abonos de venta y notas de crédito** | **CUMPLE** | [`frontend-web/src/pages/facturacion/Facturacion.jsx`](frontend-web/src/pages/facturacion/Facturacion.jsx): Emisión de facturas con cálculo de subtotal e IVA, notas de crédito por devoluciones (`/devoluciones`), y registro de abonos a cuentas por cobrar en [`backend/src/modules/cartera/cartera.service.js`](backend/src/modules/cartera/cartera.service.js) (`pagarCxc`). |
| **Emite compras y abonos de compra** | **CUMPLE** | [`frontend-web/src/pages/compras/Compras.jsx`](frontend-web/src/pages/compras/Compras.jsx): Órdenes de compra a proveedores, recepción de mercadería con recálculo de costo promedio, y registro de abonos a cuentas por pagar en `cartera.service.js` (`pagarCxp`). |
| **El sistema permite registrar inventario** | **CUMPLE** | [`frontend-web/src/pages/inventario/Inventario.jsx`](frontend-web/src/pages/inventario/Inventario.jsx): Registro de productos con SKU, código de barras, categoría, precio de venta, costo, stock y galería de imágenes. |
| **Alertas automáticas por bajo stock** | **CUMPLE** | Verificación en tiempo real de `stock <= stock_minimo`. Destaca los productos en alerta con etiquetas de advertencia en inventario y tarjetas de métricas en el Dashboard principal. |
| **Las alertas ayudan a prevenir faltantes** | **CUMPLE** | Filtro de inventario `"Solo stock bajo"` y generación de reportes específicos para reabastecimiento con proveedores. |
| **Notificaciones y recordatorios oportunos** | **CUMPLE** | Módulo [`backend/src/utils/email.js`](backend/src/utils/email.js) con soporte SMTP / Gmail y Resend para envíos de confirmación y restablecimiento con plantillas HTML limpias y enlaces de un solo uso. |

---

## 4. 📊 Módulo de Reportes

| Requisito | Estado | Evidencia Técnica en el Código |
| :--- | :---: | :--- |
| **Reporte de citas por fecha, identificación y nombre** | **CUMPLE** | En [`frontend-web/src/pages/reportes/Reportes.jsx`](frontend-web/src/pages/reportes/Reportes.jsx) y [`backend/src/modules/reportes/reportes.service.js`](backend/src/modules/reportes/reportes.service.js): filtros por fecha (`fecha_inicio`, `fecha_fin`), búsqueda dinámica por nombre o cédula (`paciente`), y columna de Cédula / Identificación en tabla y CSV. |
| **Reporte de citas atendidas, canceladas y reagendadas** | **CUMPLE** | Selector desplegable de estados (`Pendiente`, `Confirmada`, `En atención`, `Atendida`, `Cancelada`, `No asistio`) y distinción de citas reagendadas. |
| **Reporte de atenciones por médico** | **CUMPLE** | Selector interactivo de profesionales (`medicos`) que filtra todas las consultas asignadas y atendidas por cada optómetra. |
| **Reporte de ventas** | **CUMPLE** | Rango de fechas, desglose por forma de pago (Efectivo, Tarjeta, Transferencia, Crédito), total facturado y exportación a CSV. |
| **Reporte de compras** | **CUMPLE** | Rango de fechas, selección de proveedor, total comprado y exportación a CSV. |
| **Reportes de inventario** | **CUMPLE** | Clasificación por categorías, filtro exclusivo de productos en riesgo de desabastecimiento (`Solo stock bajo`) y exportación a CSV. |

---

## 5. 🚀 Innovación en el Desarrollo del Sistema

1. **Probador Virtual con Inteligencia Artificial y Visión por Computador ([`frontend-web/src/pages/catalogo/ProbadorVirtual.jsx`](frontend-web/src/pages/catalogo/ProbadorVirtual.jsx)):**
   - Detección de puntos de referencia faciales (Face Landmarks) en tiempo real mediante la cámara del usuario para ajustar y probar monturas de lentes digitalmente sobre el rostro del cliente.
2. **Cifrado Clínico AES-256-GCM a Nivel de Columna:**
   - Protección criptográfica de los datos médicos de los pacientes en reposo, garantizando cumplimiento de normativas de confidencialidad y protección de datos personales de salud.
3. **Bloqueo Legal e Inmutabilidad de Historias Clínicas (24 horas):**
   - Trigger a nivel de base de datos PostgreSQL que sella automáticamente el expediente clínico a las 24 horas de creado, impidiendo manipulaciones posteriores salvo desbloqueo administrativo auditado con motivo obligatorio.
4. **App Móvil Híbrida y Resiliente (Expo / React Native):**
   - Sincronización en la nube con API REST en AWS EC2 y base de datos Supabase, con recuperación inteligente de sesiones y experiencia nativa fluida para el paciente.
5. **Exportación Dinámica a Formatos de Hoja de Cálculo (CSV):**
   - Motor de exportación del lado del cliente que respeta los filtros visuales aplicados para auditoría y contabilidad externa inmediata.
