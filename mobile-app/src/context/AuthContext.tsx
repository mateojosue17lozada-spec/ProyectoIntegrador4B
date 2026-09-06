import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { guardarToken, observarSesionExpirada } from "../services/api";
import * as authService from "../services/auth.service";
import { Rol, Usuario } from "../types";

const CLAVE_USUARIO = "optica_usuario";

interface ValorAuth {
    usuario: Usuario | null;
    cargando: boolean;
    esPaciente: boolean;
    esProfesional: boolean;
    puedeUsarCaja: boolean;
    iniciarSesion: (identificador: string, password: string) => Promise<void>;
    cerrarSesion: () => Promise<void>;
    refrescarUsuario: () => Promise<void>;
}

const AuthContext = createContext<ValorAuth | undefined>(undefined);

const ROLES_CAJA: Rol[] = ["Administrador", "Cajero"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [cargando, setCargando] = useState(true);

    const limpiarLocal = useCallback(async () => {
        setUsuario(null);
        await guardarToken(null);
        await AsyncStorage.removeItem(CLAVE_USUARIO);
    }, []);

    // Arranque: se muestra el usuario cacheado de inmediato para no dejar la
    // pantalla en blanco, y en paralelo se valida contra /auth/me. Si el
    // servidor dice que la sesion murio, se limpia.
    useEffect(() => {
        let vivo = true;

        (async () => {
            const cacheado = await AsyncStorage.getItem(CLAVE_USUARIO);
            if (cacheado && vivo) {
                try {
                    setUsuario(JSON.parse(cacheado) as Usuario);
                } catch {
                    await AsyncStorage.removeItem(CLAVE_USUARIO);
                }
            }

            try {
                const actual = await authService.sesionActual();
                if (!vivo) return;
                setUsuario(actual);
                await AsyncStorage.setItem(CLAVE_USUARIO, JSON.stringify(actual));
            } catch {
                if (vivo) await limpiarLocal();
            } finally {
                if (vivo) setCargando(false);
            }
        })();

        return () => {
            vivo = false;
        };
    }, [limpiarLocal]);

    // El interceptor de axios avisa cuando el backend responde 401.
    useEffect(() => {
        observarSesionExpirada(() => {
            void limpiarLocal();
        });
        return () => observarSesionExpirada(null);
    }, [limpiarLocal]);

    const iniciarSesion = useCallback(async (identificador: string, password: string) => {
        const conectado = await authService.login(identificador, password);
        setUsuario(conectado);
        await AsyncStorage.setItem(CLAVE_USUARIO, JSON.stringify(conectado));
    }, []);

    const cerrarSesion = useCallback(async () => {
        try {
            await authService.logout();
        } finally {
            await limpiarLocal();
        }
    }, [limpiarLocal]);

    const refrescarUsuario = useCallback(async () => {
        const actual = await authService.sesionActual();
        setUsuario(actual);
        await AsyncStorage.setItem(CLAVE_USUARIO, JSON.stringify(actual));
    }, []);

    const valor = useMemo<ValorAuth>(
        () => ({
            usuario,
            cargando,
            esPaciente: usuario?.rol === "Paciente",
            esProfesional: Boolean(usuario) && usuario?.rol !== "Paciente",
            puedeUsarCaja: Boolean(usuario && ROLES_CAJA.includes(usuario.rol)),
            iniciarSesion,
            cerrarSesion,
            refrescarUsuario
        }),
        [usuario, cargando, iniciarSesion, cerrarSesion, refrescarUsuario]
    );

    return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): ValorAuth {
    const contexto = useContext(AuthContext);
    if (!contexto) throw new Error("useAuth debe usarse dentro de AuthProvider");
    return contexto;
}
