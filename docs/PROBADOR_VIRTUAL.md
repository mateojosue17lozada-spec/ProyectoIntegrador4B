# Probador virtual de monturas (Virtual Try-On)

Permite al paciente tomarse una foto (o subir una), superponer una montura del
catálogo sobre su rostro y añadir el producto al carrito con la imagen adjunta
para que el óptico revise el calce.

## Flujo de usuario

1. El paciente abre el catálogo y entra al detalle de un producto.
2. Si el producto es una montura, aparece el botón **Probar modelo**.
3. Se abre el probador con tres fuentes de imagen: **Usar cámara**, **Subir
   foto** y, en el módulo clínico, **Foto del paciente**.
4. Al cargar la foto se intenta un **encuadre automático** por detección facial:
   la montura se escala según la distancia interpupilar, se centra entre los
   ojos y se rota según la inclinación de la cabeza.
5. Si la detección falla, se avisa y quedan los deslizadores manuales (ancho,
   altura, horizontal, rotación).
6. **Reencuadrar** repite la detección, **Reiniciar** vuelve al estado inicial
   sin recargar la página y **Descargar** guarda el resultado como JPEG.
7. Para adjuntar la foto al pedido el paciente debe marcar la casilla de
   consentimiento. Sin marcarla, **Añadir al carrito** añade el producto sin
   imagen.
8. En el carrito se ve la miniatura de la prueba, con opción **Quitar foto**.
9. Al generar la solicitud, la imagen viaja en `POST /api/inventario/pedido` y
   queda en `pedido_detalle.prueba_virtual_data`.
10. El óptico ve el indicador `tiene_prueba_virtual` en el listado de pedidos y
    descarga la imagen desde `GET /api/inventario/pedido/:id/prueba/:idProducto`.

## Archivos

### Nuevos

| Archivo | Rol |
|---|---|
| `frontend-web/src/utils/faceLandmarks.js` | Carga face-api bajo demanda y calcula el encuadre |
| `frontend-web/src/utils/imagen.js` | Lectura, redimensionado y compresión de fotos |
| `frontend-web/src/components/tryon/frameShapes.js` | Formas de montura compartidas y dibujo vectorial en canvas |
| `frontend-web/src/components/tryon/VirtualTryOnStudio.jsx` | Probador completo |
| `frontend-web/src/components/tryon/TryOnModal.jsx` | Envoltorio modal |
| `supabase/migrations/20260906120000_pedido_prueba_virtual.sql` | Columna `prueba_virtual_data` |

### Modificados

| Archivo | Cambio |
|---|---|
| `frontend-web/src/pages/catalogo/ProductoDetalle.jsx` | Botón "Probar modelo" y modal |
| `frontend-web/src/pages/catalogo/Carrito.jsx` | Miniatura, quitar foto, envío al backend |
| `frontend-web/src/context/CartContext.jsx` | Parámetro `extras`, `removeTryOnImage`, resguardo de cuota |
| `frontend-web/src/pages/examenes/examenes.jsx` | Usa `frameShapes.js` en vez de duplicar la lógica |
| `frontend-web/src/index.css` | Estilos del estudio y el modal |
| `backend/src/modules/inventario/inventario.service.js` | Persiste y sirve la prueba virtual |
| `backend/src/modules/inventario/inventario.routes.js` | Ruta de descarga de la prueba |

## Instalación

**No requiere `npm install`.** face-api.js se carga desde CDN la primera vez
que se abre el probador (~1 MB, cacheado por el navegador). El bundle de la
aplicación no cambia de tamaño.

El backend detecta si la columna `prueba_virtual_data` existe y, si aún no se
aplicó la migración, sigue generando pedidos **sin** la imagen en vez de fallar.
Aplicar la migración cuando la base vuelva a estar disponible:

```bash
supabase db push
# o, directamente:
psql "$DATABASE_URL" -f supabase/migrations/20260906120000_pedido_prueba_virtual.sql
```

### Alternativa sin CDN (recomendado para producción)

Si la óptica opera sin internet estable o hay una CSP restrictiva:

```bash
cd frontend-web
npm install @vladmandic/face-api
mkdir -p public/models
cp node_modules/@vladmandic/face-api/model/{tiny_face_detector*,face_landmark_68_tiny*} public/models/
```

Y en `src/utils/faceLandmarks.js` cambiar `CDN_MODELOS` por `"/models"` y
sustituir `cargarScript` por `import("@vladmandic/face-api")`.

## Pruebas recomendadas

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | Abrir una montura del catálogo | Aparece "Probar modelo" |
| 2 | Abrir un producto que no sea montura (solución, gotas) | El botón **no** aparece |
| 3 | Subir una foto frontal con buena luz | La montura se encuadra sobre los ojos |
| 4 | Subir una foto sin rostro (un paisaje) | Aviso de no detección, deslizadores operativos |
| 5 | Denegar el permiso de cámara | Mensaje claro, "Subir foto" sigue funcionando |
| 6 | Cerrar el modal con la cámara abierta | El indicador de grabación se apaga |
| 7 | Cerrar con Escape | El modal se cierra |
| 8 | Reiniciar y probar otra montura | Sin recargar la página |
| 9 | Añadir al carrito **sin** marcar consentimiento | Producto en el carrito, sin imagen |
| 10 | Añadir al carrito **con** consentimiento | Miniatura visible en el carrito |
| 11 | Generar el pedido | `prueba_virtual_data` poblado en `pedido_detalle` |
| 12 | Consultar el pedido como Cajero | `tiene_prueba_virtual: true` en el detalle |
| 13 | Simular CDN caído (bloquear jsdelivr en DevTools) | El probador funciona en modo manual |
| 14 | Añadir muchas pruebas al carrito | No se rompe por cuota de `localStorage` |
| 15 | Probar en móvil | Layout de una columna, cámara frontal |

## Seguridad y rendimiento

- **Consentimiento explícito**: la foto solo sale del dispositivo si el paciente
  marca la casilla. Sin marcarla, el producto se añade sin imagen.
- **Todo el procesado es local**: detección facial, composición y compresión
  ocurren en el navegador. La foto original nunca se sube.
- **Tamaño acotado**: las fotos se reducen a 1080 px y se recomprimen a JPEG
  0.82 (~150–300 KB). El backend revalida con el helper `imagen()` y la base
  tiene un `CHECK` de 2.2 MB.
- **La cámara se libera** al desmontar el componente.
- **El listado de pedidos no carga las imágenes**: solo un booleano. La imagen
  se pide por su propio endpoint, restringido a Administrador, Cajero y
  Optómetra.
- **El carrito sobrevive a la cuota de `localStorage`**: si se llena, se
  reintenta sin las imágenes antes que perder el carrito.

## Limitaciones conocidas

- Funciona con **foto estática**, no con vídeo en tiempo real (decisión
  deliberada para acotar la complejidad, según el alcance pedido).
- La calidad del encuadre depende de que el producto tenga un PNG frontal con
  transparencia en `imagen_data`. Sin él se dibuja una silueta vectorial
  aproximada, útil para hacerse una idea pero no para valorar el diseño real.
- No hay oclusión ni perspectiva 3D: la montura es una capa 2D rotada.

---

# Actualización: probador virtual EN TIEMPO REAL (MediaPipe Face Mesh)

Se reemplazó el visor de foto estática por uno de **video en vivo** que sigue el
rostro fotograma a fotograma. El contrato de integración no cambió, así que
`ProductoDetalle.jsx` y el carrito quedan intactos.

## Dos correcciones de hecho respecto al pedido

1. **La columna es `imagen_data`, no `imagen_armazon`.** Verificado contra
   Supabase; `imagen_armazon` no existe. El componente usa `montura.imagen_data`.
2. **Las imágenes son base64 en la BD, no archivos en `/images/armazones/`.**
   Ese directorio público no existe. Además están guardadas como **JPEG opaco**,
   no PNG con transparencia: al superponer un JPEG opaco se ve un rectángulo, no
   una montura. Por eso, cuando el producto no trae imagen utilizable, se dibuja
   una **silueta vectorial** que sí parece unas gafas (`frameShapes.js`).
   *Recomendación:* subir PNG con transparencia a `imagen_data` para que el
   overlay sea realista.

## Archivos

| Archivo | Rol |
|---|---|
| `frontend-web/src/components/tryon/faceMesh.js` | Carga MediaPipe desde CDN + matemática de las 3 orientaciones |
| `frontend-web/src/components/tryon/VirtualTryOnLive.jsx` | Componente de video en tiempo real |
| `TryOnModal.jsx` | Repuntado al componente live (antes usaba el de foto estática) |
| `index.css` | Estilos `.tryon-canvas--live`, `.tryon-estado`, `.tryon-control`, … |

`VirtualTryOnStudio.jsx` y `faceLandmarks.js` (versión de foto estática) siguen
en el repo como respaldo, pero ya no se usan desde el modal.

## Modelo de las 3 orientaciones

A partir de 3 referencias — centro de cada ojo y puente de la nariz:

- **Posición:** punto medio entre los ojos.
- **Escala:** distancia interpupilar × factor de calibración (2.15).
- **Rotación (inclinada, roll):** ángulo de la línea entre los ojos → la montura
  rota igual.
- **Giro lateral (yaw):** el desfase horizontal de la nariz respecto al centro de
  los ojos aproxima `sin(yaw)`. La montura se **comprime en horizontal por
  `cos(yaw)`** y se desplaza hacia el lado visible, simulando la perspectiva
  hasta ~90°.

La transformación se **suaviza** con interpolación entre frames para eliminar el
temblor.

## Instalación

**No requiere `npm install`.** MediaPipe Face Mesh se carga desde CDN
(`cdn.jsdelivr.net/npm/@mediapipe/face_mesh`) la primera vez que se abre el
probador, con indicador de carga. El bundle principal no cambia de tamaño (586 kB).
La cámara usa `getUserMedia` directo (sin `react-webcam`), una dependencia menos.

Si se quiere sin CDN: `npm i @mediapipe/face_mesh`, copiar los assets a
`public/mediapipe/` y cambiar `CDN` por `/mediapipe` en `faceMesh.js`.

## Integración con el flujo existente

- **Qué producto se prueba:** `TryOnModal` recibe `monturas={[producto]}` y
  `monturaInicial={producto.id_producto}` desde `ProductoDetalle.jsx`. La imagen
  del armazón sale de `producto.imagen_data`.
- **Añadir al carrito:** `onAnadirAlCarrito(imagen, montura)` → el mismo
  `handleProbadoAlCarrito` de antes, que llama a `addToCart(producto, cantidad,
  {tipo}, {prueba_virtual})`. La imagen compuesta solo viaja si el usuario marca
  el consentimiento.

## Rendimiento

- Detección limitada a **~10 fps** (`MS_ENTRE_DETECCIONES = 100`), con guardia
  para no encolar frames si el anterior no terminó.
- Render con `requestAnimationFrame` en un **único bucle**; todo se dibuja en un
  solo `<canvas>` (video espejo + montura), lo que hace la captura trivial
  (`toDataURL`).
- El modelo se carga async con spinner. La cámara y el detector se liberan al
  cerrar el modal (apaga el indicador de grabación).

## Pruebas manuales sugeridas

| # | Caso | Esperado |
|---|---|---|
| 1 | "Usar cámara" con buena luz | La montura sigue los ojos en vivo |
| 2 | Inclinar la cabeza (roll) | La montura rota con la cabeza |
| 3 | Girar de lado (yaw hasta ~90°) | La montura se comprime y se desplaza |
| 4 | Poca luz / sin rostro | "Buscando rostro…" y los controles manuales funcionan |
| 5 | Rostros con distinta IPD | La escala se adapta a cada uno |
| 6 | Arrastrar la montura con el mouse/dedo | Se mueve y deja de seguir el rostro |
| 7 | Deslizadores ancho/alto/rotación | Ajustan sobre el encuadre automático |
| 8 | "Subir foto" (fallback) | Detección en una pasada sobre la imagen |
| 9 | CDN bloqueado (DevTools) | Aviso y modo manual operativo |
| 10 | "Descargar" | Baja un JPG con la composición |
| 11 | Añadir al carrito con/ sin consentimiento | Con foto / sin foto |
| 12 | Cerrar el modal | Se apaga el indicador de cámara |

## Limitaciones

- El overlay realista depende de que `imagen_data` sea un **PNG con
  transparencia**. Con los JPEG actuales se usa la silueta vectorial.
- El modelo de yaw es una aproximación 2D (compresión + desplazamiento), no un
  render 3D con oclusión.

---

## Correcciones (probador definitivo)

- **Efecto espejo corregido.** El reflejo ahora depende del `facingMode` real
  (`espejoRef`): la cámara frontal se refleja, la trasera y las fotos subidas no.
  Video y landmarks se voltean con la misma bandera, así que el seguimiento es
  natural en ambas.
- **La montura se ancla al puente de la nariz** (landmark 168), no al punto medio
  de los ojos. Esto elimina el término `sin(yaw)` que empujaba la montura en
  sentido contrario al girar la cabeza; ahora pivota sobre la nariz como unas
  gafas reales. El yaw solo modula la compresión horizontal (`cos(yaw)`).
- **Transparencia real detectada.** Solo se usa `imagen_data` como overlay si es
  PNG/WEBP *y* tiene píxeles con alfa < 250 (se muestrea a 32×32). Un JPEG opaco
  o una imagen sin alfa cae a la **silueta vectorial**. Nunca se pinta fondo
  blanco bajo la montura.
- **Arrastre con prioridad sin apagar el seguimiento**: el desplazamiento manual
  se suma al encuadre automático, en píxeles de pantalla (coherente con o sin
  espejo).
- **Descarga en PNG**; el adjunto al carrito sigue en JPEG (más liviano, respeta
  el CHECK de 2.2 MB del backend).
- **Suavizado exponencial** con factor 0.3 (retiene el 70% del frame previo).
