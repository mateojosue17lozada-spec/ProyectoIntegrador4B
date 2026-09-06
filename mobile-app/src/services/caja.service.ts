import { api } from "./api";
import { ResumenDashboard, TurnoCaja } from "../types";

/** GET /caja. Devuelve null si el cajero no tiene turno abierto. */
export const turnoAbierto = async (): Promise<TurnoCaja | null> => {
    const { data } = await api.get<TurnoCaja | null>("/caja");
    return data || null;
};

/** POST /caja/abrir. Falla si ya se cerro la caja hoy (409). */
export const abrirCaja = async (monto_apertura: number): Promise<TurnoCaja> => {
    const { data } = await api.post<TurnoCaja>("/caja/abrir", { monto_apertura });
    return data;
};

/** POST /caja/cerrar. El backend calcula la diferencia contra lo esperado. */
export const cerrarCaja = async (
    monto_cierre: number,
    observaciones?: string
): Promise<TurnoCaja> => {
    const { data } = await api.post<TurnoCaja>("/caja/cerrar", { monto_cierre, observaciones });
    return data;
};

/** GET /caja/historial */
export const historialCaja = async (): Promise<TurnoCaja[]> => {
    const { data } = await api.get<TurnoCaja[] | { rows: TurnoCaja[] }>("/caja/historial");
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.rows) ? data.rows : [];
};

/** GET /dashboard. No accesible para el rol Paciente. */
export const resumenDelDia = async (): Promise<ResumenDashboard> => {
    const { data } = await api.get<ResumenDashboard>("/dashboard");
    return data;
};
