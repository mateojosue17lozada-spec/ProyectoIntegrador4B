import { api } from "./api";
import { Cita, CitaAgenda, Profesional } from "../types";

/** GET /citas/mis-citas (rol Paciente). Devuelve hasta 30, mas recientes primero. */
export const misCitas = async (): Promise<Cita[]> => {
    const { data } = await api.get<Cita[]>("/citas/mis-citas");
    return Array.isArray(data) ? data : [];
};

/** POST /citas/mis-citas. Crea el registro de paciente si aun no existe. */
export const agendarCita = async (datos: {
    id_usuario: number;
    fecha_cita: string;
    hora_cita: string;
    motivo: string;
}): Promise<Cita> => {
    const { data } = await api.post<Cita>("/citas/mis-citas", datos);
    return data;
};

/** POST /citas/mis-citas/:id/cancelar */
export const cancelarCita = async (idCita: number, motivo?: string): Promise<Cita> => {
    const { data } = await api.post<Cita>(`/citas/mis-citas/${idCita}/cancelar`, { motivo });
    return data;
};

/** POST /citas/mis-citas/:id/reagendar. El backend rechaza fechas y horas pasadas. */
export const reagendarCita = async (
    idCita: number,
    fecha_cita: string,
    hora_cita: string
): Promise<Cita> => {
    const { data } = await api.post<Cita>(`/citas/mis-citas/${idCita}/reagendar`, {
        fecha_cita,
        hora_cita
    });
    return data;
};

/** GET /citas/profesionales. Accesible tambien para el rol Paciente. */
export const profesionales = async (): Promise<Profesional[]> => {
    const { data } = await api.get<Profesional[]>("/citas/profesionales");
    return Array.isArray(data) ? data : [];
};

/** GET /citas (agenda del personal). No accesible para Paciente. */
export const agenda = async (fecha?: string): Promise<CitaAgenda[]> => {
    const { data } = await api.get<CitaAgenda[] | { citas: CitaAgenda[] }>("/citas", {
        params: fecha ? { fecha } : undefined
    });
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.citas) ? data.citas : [];
};

/** PATCH /citas/:id. Cambia el estado desde la agenda del profesional. */
export const cambiarEstadoCita = async (idCita: number, estado: string): Promise<CitaAgenda> => {
    const { data } = await api.patch<CitaAgenda>(`/citas/${idCita}`, { estado });
    return data;
};
