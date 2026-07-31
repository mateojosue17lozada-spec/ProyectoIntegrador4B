# Sistema de diseño — Óptica Integral

## Principios

- Priorizar lectura rápida, operación prolongada y seguridad clínica.
- Una acción primaria por contexto; acciones secundarias con estilo neutro.
- No comunicar estados únicamente mediante color: usar siempre texto.
- No mostrar controles sin contrato funcional o permiso backend.

## Fundamentos

- **Primario:** verde petróleo para acciones y foco.
- **Secundario:** azul clínico para información.
- **Superficies:** blanco y grises azulados; bordes suaves, sombras contenidas.
- **Estados:** verde éxito, ámbar advertencia, rojo error y azul información.
- **Espaciado:** múltiplos de 4 px; separaciones frecuentes de 8, 12, 16, 24 y 32 px.
- **Radio:** 7–16 px según control/superficie; evitar píldoras salvo estados breves.

## Componentes compartidos

Los componentes están en `frontend-web/src/components/ui.jsx`.

- `PageHeader`: título, contexto y acción principal.
- `SectionCard`: superficie de sección con jerarquía consistente.
- `StatusBadge`: estado acompañado de texto y tono semántico.
- `LoadingState`: carga localizada, sin bloquear toda la página.
- `EmptyState`: ausencia de resultados con orientación siguiente.
- `ErrorState`: error comprensible y acción opcional de reintento.

Patrones CSS compartidos:

- `.table-toolbar` para búsqueda, filtros y contador.
- `.pagination` para navegación de resultados.
- `.drawer` y `.drawer-backdrop` para crear/ver detalles sin perder contexto.
- `.calendar`, `.agenda-list` y `.appointment` para agenda.

## Accesibilidad

- Foco visible global.
- Botones deshabilitados mantienen estado perceptible.
- Drawers usan `role="dialog"` y `aria-modal`.
- Botones iconográficos requieren `aria-label`.
- Encabezados de tabla permanecen visibles durante desplazamiento.

## Responsive

- Menú lateral se transforma en drawer.
- Perfil y dashboards pasan a una columna.
- Calendario mantiene integridad mediante desplazamiento horizontal controlado; la vista Lista es la alternativa móvil.
- Drawers ocupan todo el ancho disponible en pantallas estrechas.

## Uso recomendado

Antes de crear un aviso, tabla, estado vacío o encabezado nuevo, reutilizar los componentes anteriores. Solo extraer un componente adicional cuando el patrón aparezca en más de un módulo y tenga comportamiento consistente.
