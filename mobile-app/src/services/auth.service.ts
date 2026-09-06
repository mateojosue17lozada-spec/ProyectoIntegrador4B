import { api, extraerTokenDeCookie, guardarToken } from "./api";
import { Perfil, Usuario } from "../types";

/**
 * POST /auth/login
 * El cuerpo acepta `identificador` (correo o nombre de usuario indistintamente,
 * ver auth.service.js: obtenerUsuarioPorIdentificador).
 */
export const login = async (identificador: string, password: string): Promise<Usuario> => {
    const respuesta = await api.post<{ mensaje: string; usuario: Usuario }>("/auth/login", {
        identificador: identificador.trim(),
        password
    });

    const token = extraerTokenDeCookie(respuesta);
    if (token) await guardarToken(token);

    return respuesta.data.usuario;
};

/** GET /auth/me. Fuente de verdad al arrancar la app. */
export const sesionActual = async (): Promise<Usuario> => {
    const { data } = await api.get<{ usuario: Usuario }>("/auth/me");
    return data.usuario;
};

/** GET /auth/profile */
export const obtenerPerfil = async (): Promise<Perfil> => {
    const { data } = await api.get<Perfil>("/auth/profile");
    return data;
};

/** PATCH /auth/profile. El backend solo acepta estos cuatro campos. */
export const actualizarPerfil = async (cambios: {
    nombre: string;
    apellido?: string | null;
    telefono?: string | null;
    fecha_nacimiento?: string | null;
}): Promise<Perfil> => {
    const { data } = await api.patch<Perfil>("/auth/profile", cambios);
    return data;
};

/** POST /auth/forgot-password. Responde igual exista o no el usuario. */
export const solicitarRecuperacion = async (identificador: string): Promise<string> => {
    const { data } = await api.post<{ mensaje: string }>("/auth/forgot-password", {
        identificador: identificador.trim()
    });
    return data.mensaje;
};

/** POST /auth/logout. Revoca la sesion en el servidor. */
export const logout = async (): Promise<void> => {
    try {
        await api.post("/auth/logout");
    } finally {
        // Aunque el servidor no responda, la sesion local debe desaparecer.
        await guardarToken(null);
    }
};
