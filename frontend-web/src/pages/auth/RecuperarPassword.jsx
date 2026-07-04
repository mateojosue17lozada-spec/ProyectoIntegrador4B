import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { apiFetch } from "../../services/api";

export default function RecuperarPassword() {
    const [searchParams] = useSearchParams();
    const [identificador, setIdentificador] = useState("");
    const [token, setToken] = useState(searchParams.get("token") || "");
    const [password, setPassword] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [tokenDev, setTokenDev] = useState("");

    const solicitar = async (e) => {
        e.preventDefault();
        setMensaje("");
        setTokenDev("");

        try {
            const data = await apiFetch("/auth/forgot-password", {
                method: "POST",
                auth: false,
                body: { identificador }
            });

            setMensaje(data.mensaje);
            setTokenDev(data.resetToken || "");
        } catch (error) {
            setMensaje(error.message);
        }
    };

    const restablecer = async (e) => {
        e.preventDefault();
        setMensaje("");

        try {
            const data = await apiFetch("/auth/reset-password", {
                method: "POST",
                auth: false,
                body: { token, password }
            });

            setMensaje(data.mensaje);
            setToken("");
            setPassword("");
        } catch (error) {
            setMensaje(error.message);
        }
    };

    return (
        <div style={{ maxWidth: "420px", margin: "40px auto" }}>
            <h1>Recuperar contrasena</h1>

            {mensaje && <p>{mensaje}</p>}
            {tokenDev && (
                <p>
                    Token de desarrollo: <b>{tokenDev}</b>
                </p>
            )}

            <form onSubmit={solicitar}>
                <label>Correo o usuario</label>
                <input
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    required
                    style={{ width: "100%" }}
                />
                <br /><br />
                <button type="submit">Solicitar recuperacion</button>
            </form>

            <hr />

            <form onSubmit={restablecer}>
                <label>Token</label>
                <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    style={{ width: "100%" }}
                />
                <br /><br />
                <label>Nueva contrasena</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    style={{ width: "100%" }}
                />
                <br /><br />
                <button type="submit">Cambiar contrasena</button>
            </form>

            <p>
                <Link to="/login">Volver al login</Link>
            </p>
        </div>
    );
}
