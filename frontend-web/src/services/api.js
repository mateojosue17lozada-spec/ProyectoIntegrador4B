const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const limpiarSesionPor401 = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};

const sesionSigueVigente = async (token) => {
    if (!token) return false;
    try {
        return (await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        })).ok;
    } catch {
        return false;
    }
};

export const apiFetch = async (path, options = {}) => {
    const requiereAuth = options.auth !== false;
    const token = requiereAuth ? localStorage.getItem("token") : null;
    const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(!requiereAuth || !token ? {} : { Authorization: `Bearer ${token}` }),
        ...options.headers
    };
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401 && requiereAuth) {
            const tokenActual = localStorage.getItem("token");
            const sigueVigente = tokenActual === token && await sesionSigueVigente(token);
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
