import { EstadoCita } from "../types";
import { colores } from "../theme";

/** El backend devuelve NUMERIC como string; Number() lo normaliza. */
export const dinero = (valor: number | string | null | undefined): string =>
    `$${Number(valor || 0).toFixed(2)}`;

/** "2026-09-06" -> "sab, 6 sep". Evita `new Date(cadena)` para no aplicar zona horaria. */
export const fechaCorta = (iso: string | null | undefined): string => {
    if (!iso) return "Sin fecha";
    const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
    if (!anio || !mes || !dia) return String(iso);
    const fecha = new Date(anio, mes - 1, dia);
    return fecha.toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" });
};

export const fechaLarga = (iso: string | null | undefined): string => {
    if (!iso) return "Sin fecha";
    const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
    if (!anio || !mes || !dia) return String(iso);
    return new Date(anio, mes - 1, dia).toLocaleDateString("es-EC", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
};

/** "14:30:00" -> "14:30" */
export const hora = (valor: string | null | undefined): string =>
    valor ? String(valor).slice(0, 5) : "--:--";

export const hoyISO = (): string => {
    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");
    return `${ahora.getFullYear()}-${mes}-${dia}`;
};

/** Una cita cuenta como proxima si aun no paso y no fue cancelada. */
export const esProxima = (fecha: string, estado: EstadoCita): boolean =>
    fecha.slice(0, 10) >= hoyISO() && estado !== "Cancelada" && estado !== "Atendida";

/**
 * Paleta de la pastilla de estado. Devuelve `color` (no `texto`) para poder
 * expandirse sobre <Etiqueta>, donde `texto` es la palabra que se muestra.
 */
export const colorEstado = (estado: EstadoCita): { fondo: string; color: string } => {
    switch (estado) {
        case "Cancelada":
            return { fondo: colores.peligroSuave, color: colores.peligro };
        case "Atendida":
        case "Pagada":
            return { fondo: colores.exitoSuave, color: colores.exito };
        case "Confirmada":
        case "En atención":
            return { fondo: colores.primarioSuave, color: colores.primario };
        default:
            return { fondo: colores.avisoSuave, color: colores.aviso };
    }
};

export const iniciales = (nombre?: string | null, apellido?: string | null): string =>
    `${(nombre || "?").charAt(0)}${(apellido || "").charAt(0)}`.toUpperCase();
