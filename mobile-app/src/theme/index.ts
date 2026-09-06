/**
 * Sistema visual de la app movil.
 *
 * Deliberadamente distinto al frontend web: la web usa tarjetas planas sobre
 * fondo blanco pensadas para escritorio; aqui el color institucional ocupa la
 * cabecera, el fondo es gris muy claro y todo lo pulsable tiene una altura
 * minima de 48 px para uso con el pulgar.
 */

export const colores = {
    primario: "#1A3A6B",
    primarioClaro: "#2C5282",
    primarioSuave: "#E8EEF7",
    acento: "#F6AD55",

    exito: "#2F855A",
    exitoSuave: "#E6F4EC",
    peligro: "#C53030",
    peligroSuave: "#FDECEC",
    aviso: "#B7791F",
    avisoSuave: "#FCF3E3",

    fondo: "#F4F6FA",
    superficie: "#FFFFFF",
    borde: "#E2E8F0",

    texto: "#1A202C",
    textoSuave: "#5A6B82",
    textoInverso: "#FFFFFF"
};

export const espacio = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32
};

export const radio = {
    sm: 8,
    md: 12,
    lg: 16,
    completo: 999
};

export const tipografia = {
    titulo: { fontSize: 24, fontWeight: "700" as const, color: colores.texto },
    seccion: { fontSize: 17, fontWeight: "700" as const, color: colores.texto },
    cuerpo: { fontSize: 15, color: colores.texto },
    suave: { fontSize: 13, color: colores.textoSuave },
    dato: { fontSize: 28, fontWeight: "700" as const, color: colores.primario }
};

/** Altura minima de cualquier elemento pulsable (guia de accesibilidad tactil). */
export const ALTURA_TACTIL = 48;

export const sombra = {
    shadowColor: "#0F1D35",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
};
