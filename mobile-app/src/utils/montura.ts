import { Producto } from "../types";

const FORMAS_REDONDEADAS = ["Redonda", "Ovalada", "Aviador"];

/**
 * En la base no existe un campo `tipo`: la clasificacion sale de la categoria,
 * del tipo de lente o del nombre. Mismo criterio que usa el frontend web.
 */
export const esArmazon = (producto?: Producto | null): boolean => {
    if (!producto) return false;
    if (producto.forma_montura) return true;
    const texto = `${producto.categoria || ""} ${producto.tipo_lente || ""} ${producto.nombre || ""}`;
    return /montura|armaz[oó]n/i.test(texto);
};

export const esRedondeada = (producto?: Producto | null): boolean =>
    FORMAS_REDONDEADAS.includes(producto?.forma_montura || "");

export const colorMontura = (producto?: Producto | null): string =>
    producto?.color_montura || "#263746";
