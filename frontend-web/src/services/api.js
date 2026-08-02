const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const limpiarSesionPor401 = () => {
    localStorage.removeItem("user");
};

const sesionSigueVigente = async () => {
    try {
        return (await fetch(`${API_URL}/auth/me`, {
            credentials: "include"
        })).ok;
    } catch {
        return false;
    }
};

export const apiFetch = async (path, options = {}) => {
    const requiereAuth = options.auth !== false;
    const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
    };
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401 && requiereAuth) {
            const sigueVigente = await sesionSigueVigente();
            if (!sigueVigente) {
                limpiarSesionPor401();
                window.dispatchEvent(new CustomEvent("auth:session-expired", { detail: { path } }));
                if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
            }
        }
        throw new Error(data.mensaje || "Error de comunicacion con el servidor");
    }
    return data;
};
