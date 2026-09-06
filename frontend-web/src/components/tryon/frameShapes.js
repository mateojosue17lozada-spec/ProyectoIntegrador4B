/**
 * Formas de montura compartidas por el probador virtual.
 *
 * Extraido de pages/examenes/examenes.jsx para que el modulo clinico y el
 * catalogo usen exactamente el mismo criterio (misma tabla de compatibilidad,
 * misma silueta de respaldo).
 */

/** Formas de montura recomendadas para cada forma de rostro. Criterio estetico. */
export const compatibles = {
    Redondo: ["Rectangular", "Geométrica", "Cat-eye"],
    Cuadrado: ["Redonda", "Ovalada", "Aviador"],
    Ovalado: ["Rectangular", "Redonda", "Cat-eye", "Aviador", "Geométrica"],
    Corazón: ["Ovalada", "Aviador", "Cat-eye"],
    Alargado: ["Redonda", "Geométrica", "Aviador"],
    Diamante: ["Ovalada", "Cat-eye", "Aviador"]
};

const FORMAS_REDONDEADAS = ["Redonda", "Ovalada", "Aviador"];

export const esRedondeada = (producto) => FORMAS_REDONDEADAS.includes(producto?.forma_montura);

export const colorMontura = (producto) => producto?.color_montura || "#263746";

/** Un producto es una montura si su categoria, tipo o nombre lo indican. */
export const esArmazon = (producto) => {
    if (!producto) return false;
    if (producto.forma_montura) return true;
    const texto = `${producto.categoria || ""} ${producto.tipo_lente || ""} ${producto.nombre || ""}`;
    return /montura|armaz[oó]n/i.test(texto);
};

/**
 * Dibuja una montura vectorial en canvas, replicando la silueta CSS de
 * .generated-frame. Se usa cuando el producto no tiene imagen_data cargada,
 * para que la composicion descargada coincida con la vista previa.
 *
 * @param {CanvasRenderingContext2D} ctx contexto destino
 * @param {object} opciones geometria y estilo en pixeles del canvas
 */
export const dibujarMonturaVectorial = (ctx, { centroX, centroY, ancho, rotacionGrados, color, redondeada }) => {
    const alto = ancho * 0.36;
    const anchoLente = ancho * 0.43;
    const altoLente = alto * 0.82;
    const grosor = Math.max(2, ancho * 0.028);
    const separacion = ancho * 0.14;

    ctx.save();
    ctx.translate(centroX, centroY);
    ctx.rotate((rotacionGrados * Math.PI) / 180);

    ctx.strokeStyle = color;
    ctx.fillStyle = "rgba(205,231,242,0.2)";
    ctx.lineWidth = grosor;
    ctx.lineJoin = "round";

    const dibujarLente = (desplazamientoX) => {
        ctx.beginPath();
        if (redondeada) {
            ctx.ellipse(desplazamientoX, 0, anchoLente / 2, altoLente / 2, 0, 0, Math.PI * 2);
        } else {
            const radio = anchoLente * 0.18;
            const x = desplazamientoX - anchoLente / 2;
            const y = -altoLente / 2;
            // roundRect no existe en navegadores anteriores a 2022
            if (ctx.roundRect) ctx.roundRect(x, y, anchoLente, altoLente, radio);
            else ctx.rect(x, y, anchoLente, altoLente);
        }
        ctx.fill();
        ctx.stroke();
    };

    const offset = separacion / 2 + anchoLente / 2;
    dibujarLente(-offset);
    dibujarLente(offset);

    // Puente central
    ctx.beginPath();
    ctx.moveTo(-separacion / 2, 0);
    ctx.lineTo(separacion / 2, 0);
    ctx.stroke();

    // Patillas laterales
    const inicioPatilla = offset + anchoLente / 2;
    const largoPatilla = ancho * 0.16;
    const caidaPatilla = largoPatilla * 0.14;
    [-1, 1].forEach((lado) => {
        ctx.beginPath();
        ctx.moveTo(lado * inicioPatilla, -altoLente * 0.12);
        ctx.lineTo(lado * (inicioPatilla + largoPatilla), -altoLente * 0.12 + caidaPatilla);
        ctx.stroke();
    });

    ctx.restore();
};
