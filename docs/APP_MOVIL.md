# App móvil (Expo) — Óptica Integral

App companion en Expo SDK 52 + TypeScript. Vive en `mobile-app/`, es
independiente del frontend web y **no requiere ningún cambio en el backend**.

## Estructura

```
mobile-app/
├── App.tsx                     Providers + navegador raíz
├── app.json / eas.json         Configuración Expo y EAS Build
├── tsconfig.json / babel.config.js
├── .env.example
└── src/
    ├── theme/index.ts          Colores, espaciado, tipografía
    ├── types/index.ts          Tipos derivados de las respuestas reales
    ├── services/
    │   ├── api.ts              axios + interceptores + estrategia de sesión
    │   ├── auth.service.ts     login, perfil, recuperación, logout
    │   ├── citas.service.ts    mis-citas, cancelar, reagendar, agenda
    │   ├── catalogo.service.ts catálogo y detalle
    │   ├── pedidos.service.ts  generar pedido
    │   └── caja.service.ts     turnos de caja y dashboard
    ├── context/
    │   ├── AuthContext.tsx     Sesión, roles, arranque
    │   └── CartContext.tsx     Carrito persistido
    ├── components/
    │   ├── Base.tsx            Tarjeta, Boton, Etiqueta, Dato, Fila...
    │   └── ProbadorVirtual.tsx Probador con gestos y detección facial
    ├── utils/
    │   ├── formato.ts          Fechas, dinero, estados
    │   ├── montura.ts          Clasificación de armazones
    │   └── rostro.ts           Normalización de detección facial
    ├── navigation/RootNavigator.tsx
    └── screens/                11 pantallas
```

## Ejecución

```bash
cd mobile-app
npm install
cp .env.example .env      # y pon la IP de tu máquina en la LAN
npx expo start
```

`localhost` **no funciona** desde un teléfono: usa la IP de tu equipo
(`ipconfig` en Windows), y asegúrate de que el backend escuche en `0.0.0.0`.

### Expo Go vs development build

| Función | Expo Go | Development build |
|---|---|---|
| Login, citas, catálogo, carrito, perfil, caja | ✅ | ✅ |
| Probador: foto, gestos, guardar | ✅ | ✅ |
| Probador: encuadre automático por rostro | ❌ (modo manual) | ✅ |

ML Kit es un módulo nativo y no está en Expo Go. La app lo detecta y cae a
modo manual sin romperse. Para probar el encuadre automático:

```bash
npx expo install expo-dev-client
eas build --profile development --platform android
```

## Generar APK con EAS Build

```bash
npm install -g eas-cli
eas login
eas init                                    # rellena extra.eas.projectId en app.json
eas build --profile preview --platform android
```

El perfil `preview` produce un **APK** instalable. Antes de lanzar, pon la URL
pública del backend en `eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`:
un APK apuntando a `192.168.x.x` solo funciona en tu red local.

## Decisiones técnicas

### Detección facial: por qué no `expo-face-detector`

**`expo-face-detector` se eliminó en Expo SDK 51**, así que no existe para SDK
52. Las alternativas eran:

- **react-native-vision-camera + face-detector plugin**: procesa fotogramas en
  vivo. Exige frame processors, Reanimated/Worklets y build nativa. Es mucha
  maquinaria para lo que aquí se necesita, que es una foto estática.
- **ML Kit sobre imagen ya capturada** (`@react-native-ml-kit/face-detection`):
  una sola pasada sobre un fichero, sin cámara en vivo.

Se eligió ML Kit, **con la regla de que el probador nunca dependa de él**. El
posicionamiento manual por gestos es el camino garantizado; la detección solo
ahorra el primer encuadre.

`src/utils/rostro.ts` normaliza el resultado: usa los landmarks de los ojos si
existen y, si no, estima desde la caja del rostro (todo detector devuelve al
menos la caja). Eso lo hace resistente a diferencias entre versiones.

### Cámara: `expo-image-picker` en vez de `expo-camera`

`launchCameraAsync` abre la cámara del sistema: mejor calidad, sin superficie
propia que mantener y una dependencia menos. `expo-camera` solo haría falta
para una previsualización en vivo, que este flujo no usa.

### Sesión: el token no viaja en el JSON

`auth.controller.js` entrega el JWT **solo como cookie HttpOnly** y lo quita del
cuerpo:

```js
const { token, ...respuestaJSON } = resultado;
res.json(respuestaJSON);
```

...pero `auth.middleware.js` **sí acepta `Authorization: Bearer`**. Como el
backend no se toca, `src/services/api.ts` usa dos caminos:

1. Lee `Set-Cookie` de la respuesta de login y guarda el token en SecureStore
   para mandarlo como Bearer. Determinista cuando el SO expone la cabecera
   (habitual en Android).
2. Si no es visible (habitual en iOS, donde NSURLSession la absorbe), la
   petición viaja igual por el almacén de cookies nativo de React Native.

En ambos casos `GET /auth/me` decide al arrancar si la sesión sigue viva.

> **Recomendado**: añadir `token` al JSON de login eliminaría la ambigüedad.
> Es un cambio de una línea en `auth.controller.js:24`, pero queda fuera de
> este alcance por la restricción de no tocar el backend.

### Sin pantalla de registro

`POST /auth/register` exige sesión iniciada **y rol Administrador**
(`auth.routes.js:34-40`). Un paciente no puede crearse una cuenta solo. La
pantalla de login lo explica y remite a la óptica. Habilitarlo requeriría una
ruta pública nueva en el backend.

## Endpoints usados

| Pantalla | Método y ruta | Rol |
|---|---|---|
| Login | `POST /auth/login` | público |
| Recuperar | `POST /auth/forgot-password` | público |
| Arranque | `GET /auth/me` | autenticado |
| Perfil | `GET` / `PATCH /auth/profile` | autenticado |
| Inicio y Citas | `GET /citas/mis-citas` | Paciente |
| Citas | `POST /citas/mis-citas/:id/cancelar` | Paciente |
| Citas | `POST /citas/mis-citas/:id/reagendar` | Paciente |
| Catálogo | `GET /inventario/catalogo` | autenticado |
| Detalle y probador | `GET /inventario/catalogo/:id` | autenticado |
| Carrito | `POST /inventario/pedido` | Paciente |
| Jornada | `GET /dashboard` | personal |
| Jornada | `GET /citas` | personal |
| Caja | `GET /caja`, `POST /caja/abrir`, `POST /caja/cerrar`, `GET /caja/historial` | Administrador, Cajero |

### Manejo de errores

El backend responde siempre `{ mensaje }`. El interceptor de `api.ts` lo
convierte en un `Error` con ese texto, de modo que ninguna pantalla inspecciona
la forma del error. Ante un `401` borra el token y avisa a `AuthContext`, que
devuelve al login.

## Diferencias con el frontend web

| | Web | Móvil |
|---|---|---|
| Inicio | Rejilla de métricas | La próxima cita, en grande |
| Navegación | Menú lateral | Tabs inferiores por rol |
| Catálogo | Tabla/listado | Rejilla de 2 columnas con insignia "Probar" |
| Probador | Deslizadores | Gestos: arrastrar y pellizcar |
| Foto | Webcam o archivo | Cámara del sistema o galería |
| Caja | Módulo completo | Solo abrir, cerrar y últimos cierres |

## Pruebas recomendadas

| # | Caso | Esperado |
|---|---|---|
| 1 | Login con credenciales válidas | Entra a los tabs de su rol |
| 2 | Login con contraseña errónea 3 veces | Mensaje de bloqueo temporal |
| 3 | Cerrar y reabrir la app | Sesión conservada, sin volver a entrar |
| 4 | Backend apagado | Mensaje con la URL que se intentó |
| 5 | Entrar como Paciente | Tabs: Inicio, Citas, Catálogo, Carrito, Perfil |
| 6 | Entrar como Optómetra | Tabs: Jornada, Catálogo, Perfil (sin Caja) |
| 7 | Entrar como Cajero | Aparece el tab Caja |
| 8 | Cancelar una cita futura | Desaparece de "por venir" |
| 9 | Reagendar a una fecha pasada | El backend lo rechaza con su mensaje |
| 10 | Probador sobre una foto frontal | Montura encuadrada (dev build) |
| 11 | Arrastrar y pellizcar la montura | Se mueve y escala |
| 12 | Añadir al carrito **sin** consentimiento | Producto sin foto |
| 13 | Añadir al carrito **con** consentimiento | Miniatura en el carrito |
| 14 | Generar pedido | Número de pedido y carrito vacío |
| 15 | Abrir caja dos veces el mismo día | Error 409 del backend |

## Limitaciones conocidas

- **No verificado en dispositivo**: la base de datos está caída, así que no se
  pudo probar login ni ninguna pantalla contra datos reales. Lo verificado es
  typecheck y bundle de producción.
- **Notificaciones push**: no implementadas. El backend no expone registro de
  tokens de dispositivo ni envío, así que requeriría trabajo de servidor.
- **Reagendar** usa campos de texto (`AAAA-MM-DD`, `HH:MM`) en vez de un
  selector de calendario, para no añadir dependencias. El backend valida.
- **El probador** trabaja sobre foto estática, no vídeo en tiempo real.

---

## Actualización: pedidos, comprobante QR y galería

La app ya existía (`mobile-app/`, no `mobile/` — se conservó el nombre para no
romper la build). Se añadieron las piezas que faltaban frente al brief del
paciente, sin tocar el backend:

### Nuevo
- **`components/QRComprobante.tsx`** — comprobante de retiro con **QR**
  (`react-native-qrcode-svg`). Codifica `OPTICA:PEDIDO:<id>`; el cajero lo escanea
  en la web para localizar y cobrar el pedido. Es la pieza que conecta el pedido
  móvil con la caja física — un diferenciador que la web no tiene.
- **`screens/PedidosScreen.tsx`** — historial de pedidos del paciente
  (`GET /facturacion/mis-pedidos`), con estado, detalle y despliegue del QR para
  los pendientes. Navegable desde Inicio, Carrito y Perfil (no ocupa un tab).
- **`services/pedidos.service.ts`** — `misPedidos()`.

### Modificado
- **`CarritoScreen`** — al generar el pedido, muestra el **QR de retiro** y un
  acceso a "Mis pedidos".
- **`ProductoDetalleScreen`** — **carrusel de imágenes** con miniaturas, usando el
  array `imagenes` (`producto_imagenes`) que ahora devuelve el backend; cae a la
  portada `imagen_data` o a un placeholder.
- **`InicioPacienteScreen`** — tarjeta de **"último pedido"** con su estado y
  contadores (pendientes/completados), más un acceso directo a Mis pedidos.
- **`PerfilScreen`** — enlace al historial de pedidos.
- **Navegación** — pantalla `Pedidos` registrada (oculta del tab bar).

### Dependencias añadidas
```bash
npx expo install react-native-svg react-native-qrcode-svg
```

### Nota de integración
`GET /facturacion/mis-pedidos` vincula al paciente **por correo** (a diferencia de
`/citas/mis-citas`, que además cruza por cédula/nombre). Para que el historial de
pedidos aparezca, el correo del usuario Paciente debe coincidir con el de su ficha
en `pacientes`. Verificado en vivo: devuelve los pedidos reales del paciente.

### Verificación
`tsc --noEmit` limpio · `expo export` OK (1307 módulos, QR/SVG resueltos) ·
`/facturacion/mis-pedidos` responde 200 con datos reales. No probado en
dispositivo físico (cámara/QR en pantalla) — pendiente de validación manual.
