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
    localStorage.removeItem("user");
};

const leerSesionGuardada = () => {
    try {
        const user = JSON.parse(localStorage.getItem("user")) || null;

        if (!user) {
            return { user: null };
        }

        // Ya no validamos el exp del token aqui porque el backend maneja la cookie.
        // La validez final la dictara cualquier request a la API que devuelva 401.
        return { user };
    } catch {
        eliminarSesionLocal("usuario guardado invalido");
        return { user: null };
    }
};

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(leerSesionGuardada);
    const { user } = session;

    useEffect(() => {
        const cerrarSesionExpirada = (event) => {
            void event;
            setSession({ user: null });
        };

        const sincronizarStorage = (event) => {
            if (event.key !== "user") return;
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

            if (!data.usuario) {
                throw new Error("Respuesta de login incompleta");
            }

            localStorage.setItem("user", JSON.stringify(data.usuario));
            setSession({ user: data.usuario });

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
        setSession({ user: null });
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export { useAuth } from "../hooks/useAuth";

