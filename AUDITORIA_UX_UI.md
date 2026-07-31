# Auditoría UX/UI del frontend web

## Alcance y diagnóstico

La interfaz tiene una identidad clínica reconocible y una base de tokens CSS, pero varios módulos evolucionaron de forma independiente. El dashboard era común para todos los roles, las acciones no estaban priorizadas por trabajo y el perfil mostraba un formulario básico sin contexto de seguridad.

### Problemas encontrados

1. **Diseño y jerarquía:** exceso de paneles con el mismo peso; formularios operativos y resúmenes compiten visualmente. Algunas páginas aún parecen CRUD genérico.
2. **Navegación:** menú plano, sin agrupación por Atención, Operación, Administración y Control. El acceso al perfil no era visible en el encabezado.
3. **Accesibilidad:** faltan estados de foco y nombres accesibles en algunos botones iconográficos heredados; tablas extensas dependen del desplazamiento horizontal.
4. **Duplicación:** tablas, avisos, filtros, estados de carga y formularios se repiten fuera de `CrudPage` sin componentes compartidos.
5. **Responsive:** el drawer funciona, pero formularios clínicos y tablas requieren revisión específica en tablet/móvil. Acciones por fila pueden saturar pantallas pequeñas.
6. **Flujos largos:** historias clínicas, facturación, compras e inventario concentran múltiples tareas en una sola vista.
7. **Estados:** varias páginas usan texto simple para carga/error/vacío; no existe una familia común `LoadingState`, `ErrorState` y `EmptyState`.
8. **Rendimiento:** algunas listas se cargan completas y se filtran/paginan en cliente; los módulos principales deben migrar gradualmente a rangos y paginación de servidor.

## Hallazgos por módulo

- **Dashboard:** resuelto en esta etapa con contenido y accesos por rol; las métricas disponibles siguen limitadas por el endpoint actual.
- **Perfil:** resuelto visualmente con identidad, estado, último acceso, sesiones, actividad y separación de campos administrativos.
- **Citas:** necesita calendario encapsulado con rango visible; actualmente prima el formulario/listado.
- **Pacientes:** tiene búsqueda y acciones, pero falta detalle por pestañas y paginación real de servidor.
- **Historias:** requiere navegación por secciones y resumen persistente del paciente.
- **Recetas:** edición e impresión deben separarse.
- **Facturación/caja:** los totales y estado de caja necesitan mayor persistencia visual.
- **Inventario/compras/cartera:** requieren toolbar, paginación y estados operativos consistentes.

## Sistema de diseño propuesto

- Mantener verde petróleo como primario, azul clínico secundario y superficies neutras.
- Escala tipográfica única basada en Manrope/Inter del proyecto y escala espacial de 4, 8, 12, 16, 24 y 32 px.
- Extraer primero patrones repetidos: `PageHeader`, `StatusBadge`, `TableToolbar`, `EmptyState`, `LoadingState`, `ErrorState`, `FormSection` y `ConfirmDialog`.
- Estados siempre con texto además de color; foco visible y áreas táctiles mínimas de 40 px.
- Desktop como operación principal, tablet para clínica y drawer/columnas apiladas en móvil.

## Prioridad siguiente

1. Calendario de citas y adaptador de rango.
2. Estados comunes y tablas profesionales.
3. Historia clínica por secciones.
4. Facturación/caja e inventario.
5. Detalle longitudinal del paciente.

No se recomienda instalar una biblioteca visual completa. La base CSS y `lucide-react` permiten evolucionar sin mezclar sistemas.

## Avance implementado

- Sistema compartido de encabezados, tarjetas de sección, badges y estados loading/error/vacío.
- Menú por grupos, breadcrumbs y perfil accesible desde el encabezado.
- Dashboard y acciones diferenciadas por rol.
- Agenda mensual y lista por rango, filtros, drawers de creación/detalle y profesional visible.
- Pacientes con paginación de servidor, filtros, contador y resumen lateral.
- Historia clínica con navegación persistente por secciones.
- Recetas e inventario heredan búsqueda, estados y paginación visual de `CrudPage`.
- Facturación con un único encabezado, flujo visual y resumen fijo de saldo.
- Foco visible, encabezados de tabla fijos y alternativas responsive.

Permanecen como evolución funcional separada las reglas que requieren nuevos contratos: duración/reprogramación completa de citas, detalle longitudinal agregado del paciente, paginación backend para todos los catálogos, devoluciones parciales, SRI y máquinas de estado exhaustivas.
