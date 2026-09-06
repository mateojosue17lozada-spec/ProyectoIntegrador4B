/**
 * Utilidades de imagen para el probador virtual.
 *
 * Las fotografias se reducen y recomprimen en el navegador antes de viajar al
 * backend: la columna imagen_data/prueba_virtual_data es TEXT con un CHECK de
 * 2.2 MB (ver migracion 20260710163000), y una foto de camara moderna en base64
 * la supera con facilidad.
 */

const LADO_MAXIMO = 1080;
const CALIDAD = 0.82;

/** Carga un dataURL en un HTMLImageElement ya decodificado. */
export const cargarImagen = (src) =>
    new Promise((resolve, reject) => {
        const imagen = new Image();
        imagen.crossOrigin = "anonymous";
        imagen.onload = () => resolve(imagen);
        imagen.onerror = () => reject(new Error("No se pudo leer la imagen"));
        imagen.src = src;
    });

/** Lee un File del input y devuelve su dataURL. */
export const leerArchivo = (archivo) =>
    new Promise((resolve, reject) => {
        if (!archivo.type?.startsWith("image/")) {
            return reject(new Error("El archivo seleccionado no es una imagen"));
        }
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
        lector.readAsDataURL(archivo);
    });

/**
 * Redimensiona a un lado maximo y recomprime como JPEG.
 * @param {string} dataUrl imagen origen
 * @param {number} ladoMaximo lado mayor permitido en pixeles
 * @returns {Promise<string>} dataURL JPEG optimizado
 */
export const optimizarImagen = async (dataUrl, ladoMaximo = LADO_MAXIMO) => {
    const imagen = await cargarImagen(dataUrl);
    const escala = Math.min(1, ladoMaximo / Math.max(imagen.naturalWidth, imagen.naturalHeight));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagen.naturalWidth * escala);
    canvas.height = Math.round(imagen.naturalHeight * escala);

    const contexto = canvas.getContext("2d");
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", CALIDAD);
};

/** Peso aproximado en bytes de un dataURL base64. */
export const pesoAproximado = (dataUrl) => {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    return Math.round((base64.length * 3) / 4);
};

/** Formatea bytes para mostrarlos al usuario. */
export const formatearPeso = (bytes) =>
    bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
