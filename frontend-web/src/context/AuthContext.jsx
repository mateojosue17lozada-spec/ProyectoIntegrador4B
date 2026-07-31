import { useEffect, useState } from "react";

import { AuthContext } from "./auth-context";
import { apiFetch } from "../services/api";

const decodificarPayloadJwt = (token) => {
    try {
        const payload = token.split(".")[1] || "";
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
        return JSON.parse(atob(padded));
    } catch {
        return null;
    }
};

const eliminarSesionLocal = (motivo) => {
    void motivo;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};

const leerSesionGuardada = () => {
    const token = localStorage.getItem("token");

    try {
        const user = JSON.parse(localStorage.getItem("user")) || null;


        if (!token || !user) {
            if (token || user) eliminarSesionLocal("storage incompleto al iniciar");
            return { token: null, user: null };
        }

        const payload = decodificarPayloadJwt(token);
        if (!payload?.exp) {
            eliminarSesionLocal("token guardado invalido");
            return { token: null, user: null };
        }

        if (payload.exp * 1000 <= Date.now()) {
            eliminarSesionLocal("token expirado al iniciar");
            return { token: null, user: null };
        }

        return { token, user };
    } catch {
        eliminarSesionLocal("usuario guardado invalido");
        return { token: null, user: null };
    }
};

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(leerSesionGuardada);
    const { token, user } = session;

    useEffect(() => {
        const cerrarSesionExpirada = (event) => {
            void event;
            setSession({ token: null, user: null });
        };

        const sincronizarStorage = (event) => {
            if (!["token", "user"].includes(event.key)) return;
            setSession(leerSesionGuardada());
        };

        window.addEventListener("auth:session-expired", cerrarSesionExpirada);
        window.addEventListener("storage", sincronizarStorage);

        return () => {
            window.removeEventListener("auth:session-expired", cerrarSesionExpirada);
            window.removeEventListener("storage", sincronizarStorage);
        };
    }, []);

    const login = async (identificador, password) => {
        try {
            const data = await apiFetch("/auth/login", {
                method: "POST",
                auth: false,
                body: {
                    identificador,
                    correo: identificador,
                    password
                }
            });

            if (!data.token || !data.usuario) {
                throw new Error("Respuesta de login incompleta");
            }

            const payload = decodificarPayloadJwt(data.token);
            localStorage.setItem("token", data.token);
            void payload;
            localStorage.setItem("user", JSON.stringify(data.usuario));
            setSession({ token: data.token, user: data.usuario });

            return { ok: true };
        } catch (error) {
            return {
                ok: false,
                mensaje: error.message || "No se pudo iniciar sesion"
            };
        }
    };

    const logout = async () => {
        try {
            await apiFetch("/auth/logout", { method: "POST" });
        } catch {
            // La sesion local siempre debe cerrarse, incluso sin conexion.
        }
        eliminarSesionLocal("logout solicitado por usuario");
        setSession({ token: null, user: null });
    };

    return (
        <AuthContext.Provider value={{ user, token, isAuthenticated: Boolean(user && token), login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
