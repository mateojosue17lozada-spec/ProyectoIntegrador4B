import axios, { AxiosError, AxiosResponse } from "axios";
import * as SecureStore from "expo-secure-store";

/**
 * Cliente HTTP contra el backend existente.
 *
 * ESTRATEGIA DE SESION
 * --------------------
 * El backend (auth.controller.js) entrega el JWT SOLO como cookie HttpOnly y
 * lo elimina del cuerpo de la respuesta:
 *
 *     const { token, ...respuestaJSON } = resultado;
 *     res.json(respuestaJSON);
 *
 * ...pero auth.middleware.js SI acepta `Authorization: Bearer`. Como el backend
 * no se modifica, la app usa dos caminos complementarios:
 *
 *  1. Intenta leer la cabecera Set-Cookie de la respuesta de login y extraer el
 *     token. Cuando el sistema operativo lo permite (habitual en Android), el
 *     token se guarda en SecureStore y se manda como Bearer en cada peticion.
 *     Es el camino deterministico.
 *  2. Si Set-Cookie no es visible para JavaScript (habitual en iOS, donde
 *     NSURLSession la absorbe), la peticion viaja igual porque React Native
 *     mantiene un almacen de cookies nativo y `withCredentials` las reenvia.
 *
 * En ambos casos la verdad sobre la sesion la da GET /auth/me al arrancar.
 *
 * RECOMENDACION: anadir `token` al JSON de /auth/login en el backend elimina
 * esta ambiguedad. Ver docs/APP_MOVIL.md.
 */

const CLAVE_TOKEN = "optica_token";

export const API_URL =
    process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.100:3000/api";

export const api = axios.create({
    baseURL: API_URL,
    timeout: 20000,
    withCredentials: true,
    headers: { "Content-Type": "application/json" }
});

let tokenEnMemoria: string | null = null;
let alExpirarSesion: (() => void) | null = null;

/** Registra el callback que cierra la sesion cuando el backend responde 401. */
export const observarSesionExpirada = (callback: (() => void) | null) => {
    alExpirarSesion = callback;
};

export const guardarToken = async (token: string | null) => {
    tokenEnMemoria = token;
    try {
        if (token) await SecureStore.setItemAsync(CLAVE_TOKEN, token);
        else await SecureStore.deleteItemAsync(CLAVE_TOKEN);
    } catch {
        // SecureStore puede no estar disponible (por ejemplo en Expo Go web).
        // La sesion sigue viva en memoria y en la cookie nativa.
    }
};

export const cargarToken = async (): Promise<string | null> => {
    if (tokenEnMemoria) return tokenEnMemoria;
    try {
        tokenEnMemoria = await SecureStore.getItemAsync(CLAVE_TOKEN);
    } catch {
        tokenEnMemoria = null;
    }
    return tokenEnMemoria;
};

/**
 * Extrae el JWT de la cabecera Set-Cookie cuando el sistema la expone.
 * Devuelve null si no es visible, que es un resultado esperado, no un error.
 */
export const extraerTokenDeCookie = (respuesta: AxiosResponse): string | null => {
    const cabecera = respuesta.headers?.["set-cookie"];
    if (!cabecera) return null;
    const texto = Array.isArray(cabecera) ? cabecera.join(";") : String(cabecera);
    const encontrado = /(?:^|[;,\s])token=([^;,\s]+)/.exec(texto);
    return encontrado ? decodeURIComponent(encontrado[1]) : null;
};

api.interceptors.request.use(async (config) => {
    const token = await cargarToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (respuesta) => respuesta,
    async (error: AxiosError<{ mensaje?: string }>) => {
        if (error.response?.status === 401) {
            await guardarToken(null);
            alExpirarSesion?.();
        }
        // El backend responde siempre { mensaje }. Se normaliza para que las
        // pantallas nunca tengan que inspeccionar la forma del error.
        const mensaje =
            error.response?.data?.mensaje ||
            (error.code === "ECONNABORTED"
                ? "El servidor tardo demasiado en responder"
                : error.request
                  ? `No se pudo conectar con ${API_URL}. Revisa que el backend este encendido y que la IP sea la de tu red.`
                  : "Error inesperado");
        return Promise.reject(new Error(mensaje));
    }
);
