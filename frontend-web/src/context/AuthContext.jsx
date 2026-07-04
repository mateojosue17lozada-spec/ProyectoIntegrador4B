import { useState } from "react";

import { AuthContext } from "./auth-context";
import { apiFetch } from "../services/api";

const leerUsuarioGuardado = () => {
    try {
        return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(leerUsuarioGuardado);

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

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.usuario));
            setUser(data.usuario);

            return { ok: true };
        } catch (error) {
            console.log(error);
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
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
