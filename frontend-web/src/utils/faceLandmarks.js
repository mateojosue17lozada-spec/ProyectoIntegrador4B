/**
 * Deteccion facial para el probador virtual de monturas.
 *
 * face-api.js se carga bajo demanda desde CDN la primera vez que el usuario
 * abre el probador: el bundle principal de la aplicacion no cambia de tamano y,
 * si la carga falla (sin internet, CDN bloqueado), el probador sigue siendo
 * usable en modo manual con los deslizadores.
 *
 * Para produccion sin dependencia de CDN ver docs/PROBADOR_VIRTUAL.md: basta
 * copiar los pesos a frontend-web/public/models y cambiar CDN_MODELOS.
 */

const CDN_SCRIPT = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
const CDN_MODELOS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

// Proporcion entre la distancia interpupilar y el ancho total de una montura.
// Una montura estandar mide aproximadamente 2.1 veces la distancia entre pupilas.
const FACTOR_ANCHO_MONTURA = 2.1;

let cargaEnCurso = null;

const cargarScript = (url) =>
    new Promise((resolve, reject) => {
        if (window.faceapi) return resolve(window.faceapi);
        const existente = document.querySelector(`script[data-faceapi="1"]`);
        if (existente) {
            existente.addEventListener("load", () => resolve(window.faceapi));
            existente.addEventListener("error", () => reject(new Error("No se pudo cargar face-api")));
            return;
        }
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.dataset.faceapi = "1";
        script.onload = () => resolve(window.faceapi);
        script.onerror = () => reject(new Error("No se pudo cargar face-api"));
        document.head.appendChild(script);
    });

/**
 * Carga (una sola vez) la libreria y los modelos de deteccion.
 * @returns {Promise<object>} instancia de faceapi lista para usar
 */
export const cargarDetector = () => {
    if (!cargaEnCurso) {
        cargaEnCurso = (async () => {
            const faceapi = await cargarScript(CDN_SCRIPT);
            if (!faceapi) throw new Error("face-api no quedo disponible en window");
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODELOS),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(CDN_MODELOS)
            ]);
            return faceapi;
        })().catch((error) => {
            cargaEnCurso = null; // permite reintentar en la siguiente apertura
            throw error;
        });
    }
    return cargaEnCurso;
};

const centro = (puntos) => {
    const total = puntos.reduce(
        (acumulado, punto) => ({ x: acumulado.x + punto.x, y: acumulado.y + punto.y }),
        { x: 0, y: 0 }
    );
    return { x: total.x / puntos.length, y: total.y / puntos.length };
};

/**
 * Detecta el rostro de una imagen y calcula la posicion ideal de la montura.
 *
 * @param {HTMLImageElement} imagen imagen ya cargada (complete === true)
 * @returns {Promise<{anchoPct:number, topPct:number, leftPct:number, rotacion:number}>}
 * @throws {Error} si no se detecta ningun rostro
 */
export const calcularAjusteMontura = async (imagen) => {
    const faceapi = await cargarDetector();

    const deteccion = await faceapi
        .detectSingleFace(imagen, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 }))
        .withFaceLandmarks(true);

    if (!deteccion) throw new Error("No se detecto ningun rostro en la imagen");

    const ancho = imagen.naturalWidth || imagen.width;
    const alto = imagen.naturalHeight || imagen.height;

    const ojoA = centro(deteccion.landmarks.getLeftEye());
    const ojoB = centro(deteccion.landmarks.getRightEye());

    // Ordenamos por coordenada X para que el angulo no dependa de que ojo
    // devolvio primero la libreria.
    const [izquierdo, derecho] = ojoA.x <= ojoB.x ? [ojoA, ojoB] : [ojoB, ojoA];

    const dx = derecho.x - izquierdo.x;
    const dy = derecho.y - izquierdo.y;
    const distanciaInterpupilar = Math.hypot(dx, dy);

    return {
        anchoPct: Math.min(95, (distanciaInterpupilar * FACTOR_ANCHO_MONTURA * 100) / ancho),
        leftPct: ((izquierdo.x + derecho.x) / 2 / ancho) * 100,
        topPct: ((izquierdo.y + derecho.y) / 2 / alto) * 100,
        // El eje Y del canvas crece hacia abajo, igual que la rotacion CSS
        // positiva, por lo que el angulo se usa sin invertir.
        rotacion: Math.max(-25, Math.min(25, (Math.atan2(dy, dx) * 180) / Math.PI))
    };
};
