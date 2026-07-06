const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const apiFetch = async (path, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.auth === false || !token ? {} : { Authorization: `Bearer ${token}` }),
        ...options.headers
    };

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401 && options.auth !== false) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
        }
        throw new Error(data.mensaje || "Error de comunicacion con el servidor");
    }

    return data;
};
