import { AjusteMontura } from "../types";

/**
 * DECISION TECNICA: deteccion facial en Expo SDK 52
 * -------------------------------------------------
 * `expo-face-detector` se elimino en Expo SDK 51, por lo que NO existe para
 * SDK 52. Las opciones reales eran:
 *
 *   a) react-native-vision-camera + react-native-vision-camera-face-detector.
 *      Procesa fotogramas en tiempo real. Potente, pero exige frame processors,
 *      Reanimated/Worklets y una build nativa; es mucha maquinaria para lo que
 *      aqui se necesita, que es una FOTO ESTATICA.
 *
 *   b) ML Kit sobre una imagen ya capturada (@react-native-ml-kit/face-detection).
 *      Es la herramienta adecuada al problema: una sola pasada sobre un fichero,
 *      sin camara en vivo. Requiere development build (no funciona en Expo Go).
 *
 * Se eligio (b), con una regla firme: el probador NUNCA depende de ella. El
 * posicionamiento manual con gestos es el camino garantizado y funciona en
 * cualquier entorno, Expo Go incluido. La deteccion solo aporta un encuadre
 * inicial automatico y, si el modulo no esta enlazado o no encuentra rostro,
 * se avisa y se sigue en manual.
 *
 * Ver docs/APP_MOVIL.md.
 */

/** Proporcion entre distancia interpupilar y ancho total de una montura. */
const FACTOR_ANCHO_MONTURA = 2.1;

/** Con solo la caja del rostro: los ojos caen a ~40% de su alto. */
const ALTURA_OJOS_EN_ROSTRO = 0.4;
/** ...y separados ~46% de su ancho. */
const SEPARACION_OJOS_EN_ROSTRO = 0.46;

export const AJUSTE_POR_DEFECTO: AjusteMontura = {
    anchoPct: 62,
    topPct: 40,
    leftPct: 50,
    rotacion: 0
};

interface Punto {
    x: number;
    y: number;
}

/** Normaliza las variantes de caja que devuelven los distintos detectores. */
const leerCaja = (rostro: any): { x: number; y: number; ancho: number; alto: number } | null => {
    const b = rostro?.frame ?? rostro?.bounds ?? rostro?.boundingBox;
    if (!b) return null;

    if (b.origin && b.size) {
        return { x: b.origin.x, y: b.origin.y, ancho: b.size.width, alto: b.size.height };
    }
    if (typeof b.left === "number" && typeof b.width === "number") {
        return { x: b.left, y: b.top, ancho: b.width, alto: b.height };
    }
    if (typeof b.x === "number" && typeof b.width === "number") {
        return { x: b.x, y: b.y, ancho: b.width, alto: b.height };
    }
    if (typeof b.left === "number" && typeof b.right === "number") {
        return { x: b.left, y: b.top, ancho: b.right - b.left, alto: b.bottom - b.top };
    }
    return null;
};

/** Busca los centros de ambos ojos entre las formas posibles de landmark. */
const leerOjos = (rostro: any): { izquierdo: Punto; derecho: Punto } | null => {
    const directo = [
        [rostro?.leftEyePosition, rostro?.rightEyePosition],
        [rostro?.landmarks?.leftEye, rostro?.landmarks?.rightEye],
        [rostro?.landmarks?.LEFT_EYE, rostro?.landmarks?.RIGHT_EYE]
    ];

    for (const [a, b] of directo) {
        const pa = a?.position ?? a;
        const pb = b?.position ?? b;
        if (typeof pa?.x === "number" && typeof pb?.x === "number") {
            return pa.x <= pb.x
                ? { izquierdo: pa, derecho: pb }
                : { izquierdo: pb, derecho: pa };
        }
    }
    return null;
};

/**
 * Convierte el resultado de un detector facial en la posicion de la montura.
 *
 * Funciona con landmarks de ojos si existen y, si no, estima a partir de la
 * caja del rostro: toda implementacion de deteccion devuelve al menos la caja,
 * asi que el encuadre automatico no se pierde por falta de landmarks.
 *
 * @param rostro objeto crudo devuelto por el detector
 * @param anchoImagen ancho de la foto analizada, en pixeles
 * @param altoImagen alto de la foto analizada, en pixeles
 */
export const ajusteDesdeRostro = (
    rostro: unknown,
    anchoImagen: number,
    altoImagen: number
): AjusteMontura | null => {
    if (!rostro || !anchoImagen || !altoImagen) return null;

    const ojos = leerOjos(rostro);

    if (ojos) {
        const dx = ojos.derecho.x - ojos.izquierdo.x;
        const dy = ojos.derecho.y - ojos.izquierdo.y;
        const interpupilar = Math.hypot(dx, dy);
        if (interpupilar > 0) {
            return {
                anchoPct: Math.min(95, (interpupilar * FACTOR_ANCHO_MONTURA * 100) / anchoImagen),
                leftPct: (((ojos.izquierdo.x + ojos.derecho.x) / 2) * 100) / anchoImagen,
                topPct: (((ojos.izquierdo.y + ojos.derecho.y) / 2) * 100) / altoImagen,
                rotacion: acotarRotacion((Math.atan2(dy, dx) * 180) / Math.PI)
            };
        }
    }

    const caja = leerCaja(rostro);
    if (!caja || !caja.ancho) return null;

    const interpupilar = caja.ancho * SEPARACION_OJOS_EN_ROSTRO;
    return {
        anchoPct: Math.min(95, (interpupilar * FACTOR_ANCHO_MONTURA * 100) / anchoImagen),
        leftPct: ((caja.x + caja.ancho / 2) * 100) / anchoImagen,
        topPct: ((caja.y + caja.alto * ALTURA_OJOS_EN_ROSTRO) * 100) / altoImagen,
        // Sin landmarks no hay informacion de inclinacion; se usa el angulo que
        // reporte el detector, si lo reporta.
        rotacion: acotarRotacion(Number((rostro as any)?.rollAngle ?? 0))
    };
};

const acotarRotacion = (grados: number): number =>
    Number.isFinite(grados) ? Math.max(-25, Math.min(25, grados)) : 0;

/**
 * Carga el detector de ML Kit solo si esta enlazado en la build.
 * En Expo Go, o si no se instalo la dependencia, devuelve null sin romper nada.
 */
export const cargarDetector = async (): Promise<
    ((ruta: string) => Promise<unknown[]>) | null
> => {
    try {
        // require dinamico: si el modulo no existe, Metro no debe tumbar la app.
        const modulo = require("@react-native-ml-kit/face-detection");
        const detectar = modulo?.default?.detect ?? modulo?.detect;
        if (typeof detectar !== "function") return null;

        return async (ruta: string) => {
            const resultado = await detectar(ruta, { landmarkMode: "all", performanceMode: "accurate" });
            return Array.isArray(resultado) ? resultado : [];
        };
    } catch {
        return null;
    }
};
