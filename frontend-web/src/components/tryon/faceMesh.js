/**
 * Deteccion facial en tiempo real con MediaPipe Face Mesh.
 *
 * MediaPipe se carga bajo demanda desde CDN la primera vez que se abre el
 * probador en vivo: no engorda el bundle principal y, si la carga falla (sin
 * internet o CDN bloqueado), el probador sigue siendo usable en modo manual.
 *
 * Modelo de las 3 orientaciones (frontal / inclinada / lateral):
 *  - Posicion:  punto medio entre los dos ojos.
 *  - Escala:    distancia interpupilar (IPD) x un factor de calibracion.
 *  - Rotacion:  angulo entre los dos ojos (roll de la cabeza).
 *  - Giro (yaw): el desfase horizontal de la nariz respecto al centro de los
 *               ojos aproxima sin(yaw). La montura se comprime en horizontal por
 *               cos(yaw) y se desplaza hacia el lado visible para simular la
 *               perspectiva cuando el rostro gira de lado.
 */

const VERSION = "0.4.1633559619";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${VERSION}`;

// Indices de landmarks de Face Mesh (468 puntos).
const OJO_IZQ = [33, 133]; // esquinas externa e interna del ojo izquierdo
const OJO_DER = [362, 263]; // esquinas del ojo derecho
const NARIZ_PUENTE = 168;

// Calibracion. La montura real es mas ancha que la distancia entre centros de
// ojo; el deslizador "Ancho" ajusta finamente sobre este valor base.
const FACTOR_ANCHO = 2.15;
// Profundidad relativa de la nariz respecto al plano de los ojos: convierte el
// desfase horizontal de la nariz en sin(yaw). Calibrado empiricamente.
const FACTOR_PROFUNDIDAD_NARIZ = 0.9;

const cargarScript = (url) =>
    new Promise((resolve, reject) => {
        if (window.FaceMesh) return resolve(window.FaceMesh);
        const existente = document.querySelector('script[data-facemesh="1"]');
        if (existente) {
            existente.addEventListener("load", () => resolve(window.FaceMesh));
            existente.addEventListener("error", () => reject(new Error("No se pudo cargar MediaPipe")));
            return;
        }
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.dataset.facemesh = "1";
        script.onload = () => resolve(window.FaceMesh);
        script.onerror = () => reject(new Error("No se pudo cargar MediaPipe"));
        document.head.appendChild(script);
    });

/**
 * Crea (una sola vez por apertura) una instancia de FaceMesh lista para recibir
 * frames. El detector se destruye al cerrar el probador.
 * @returns {Promise<object>} instancia de FaceMesh de MediaPipe
 */
export const crearDetector = async () => {
    const FaceMesh = await cargarScript(`${CDN}/face_mesh.js`);
    if (!FaceMesh) throw new Error("MediaPipe no quedo disponible en window");

    const detector = new FaceMesh({ locateFile: (archivo) => `${CDN}/${archivo}` });
    detector.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    // Fuerza la descarga de los assets WASM/modelo ahora, para que el primer
    // frame no llegue antes de que el detector este listo.
    await detector.initialize?.();
    return detector;
};

const centro = (landmarks, indices) => {
    const puntos = indices.map((i) => landmarks[i]);
    return {
        x: puntos.reduce((s, p) => s + p.x, 0) / puntos.length,
        y: puntos.reduce((s, p) => s + p.y, 0) / puntos.length
    };
};

const acotar = (valor, min, max) => Math.max(min, Math.min(max, valor));

/**
 * Convierte los landmarks (normalizados 0..1) en la transformacion de la
 * montura, en pixeles del canvas.
 *
 * @param {Array<{x:number,y:number}>} landmarks salida de Face Mesh
 * @param {number} ancho ancho del canvas en pixeles
 * @param {number} alto alto del canvas en pixeles
 * @param {boolean} espejo true si el video se dibuja en modo espejo (selfie)
 * @returns {{cx:number,cy:number,anchoMontura:number,rotacion:number,compresionX:number,yaw:number}}
 */
export const transformarDesdeLandmarks = (landmarks, ancho, alto, espejo = true) => {
    // Con el video en espejo, la coordenada X se invierte para que la montura
    // caiga sobre el rostro tal como lo ve el usuario.
    const px = (p) => ({ x: (espejo ? 1 - p.x : p.x) * ancho, y: p.y * alto });

    const ojoIzq = px(centro(landmarks, OJO_IZQ));
    const ojoDer = px(centro(landmarks, OJO_DER));
    const nariz = px(landmarks[NARIZ_PUENTE]);

    // Ordena por X para que el signo del angulo no dependa de que ojo vino
    // primero.
    const [izq, der] = ojoIzq.x <= ojoDer.x ? [ojoIzq, ojoDer] : [ojoDer, ojoIzq];

    const dx = der.x - izq.x;
    const dy = der.y - izq.y;
    const distanciaOjos = Math.hypot(dx, dy) || 1;
    const medioX = (izq.x + der.x) / 2;
    const medioY = (izq.y + der.y) / 2;

    // Roll: inclinacion de la cabeza a partir de la linea de los ojos.
    const rotacion = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Yaw: proyeccion del desfase de la nariz sobre el eje de los ojos. Se usa
    // solo para la MAGNITUD de la compresion lateral (no para desplazar), por lo
    // que su signo es irrelevante y no puede invertir el seguimiento.
    const ejeX = dx / distanciaOjos;
    const ejeY = dy / distanciaOjos;
    const desfaseNariz = (nariz.x - medioX) * ejeX + (nariz.y - medioY) * ejeY;
    const senoYaw = acotar(desfaseNariz / (distanciaOjos * FACTOR_PROFUNDIDAD_NARIZ), -1, 1);
    const yaw = Math.asin(senoYaw);

    // El centro de la montura se ancla al PUENTE DE LA NARIZ, no al punto medio
    // de los ojos. Asi la montura pivota sobre la nariz (donde de verdad se
    // apoya) y sigue el giro de la cabeza de forma natural, sin el termino de
    // desplazamiento que antes empujaba en sentido contrario.
    return {
        cx: nariz.x,
        cy: medioY,
        anchoMontura: distanciaOjos * FACTOR_ANCHO,
        rotacion,
        compresionX: Math.max(0.15, Math.cos(yaw)), // nunca colapsa del todo
        yaw
    };
};

/**
 * Suavizado exponencial entre frames para eliminar el temblor.
 * `factor` es cuanto se avanza hacia el objetivo (0.3 = retiene el 70% previo).
 */
export const suavizar = (previa, objetivo, factor = 0.3) => {
    if (!previa) return objetivo;
    const mezcla = (a, b) => a + (b - a) * factor;
    // El angulo se interpola por el camino corto para no dar la vuelta entera.
    let dRot = objetivo.rotacion - previa.rotacion;
    if (dRot > 180) dRot -= 360;
    if (dRot < -180) dRot += 360;
    return {
        cx: mezcla(previa.cx, objetivo.cx),
        cy: mezcla(previa.cy, objetivo.cy),
        anchoMontura: mezcla(previa.anchoMontura, objetivo.anchoMontura),
        rotacion: previa.rotacion + dRot * factor,
        compresionX: mezcla(previa.compresionX, objetivo.compresionX),
        yaw: mezcla(previa.yaw, objetivo.yaw)
    };
};

/** Clasifica la orientacion para el texto de ayuda al usuario. */
export const nombreOrientacion = (yaw) => {
    const grados = Math.abs((yaw * 180) / Math.PI);
    if (grados < 15) return "frontal";
    if (grados < 45) return "inclinada";
    return "lateral";
};
