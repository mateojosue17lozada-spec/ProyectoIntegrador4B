import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export const Login = () => {
    const [correo, setCorreo] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const result = await login(correo, password);

        if (result.ok) {
            navigate("/dashboard");
            return;
        }

        setError(result.mensaje || "Correo o contrasena incorrectos");
    };

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh"
            }}
        >
            <form
                onSubmit={handleSubmit}
                style={{
                    border: "1px solid #ccc",
                    padding: "40px",
                    borderRadius: "10px",
                    width: "300px"
                }}
            >
                <h2>Sistema Optico</h2>

                {error && <p style={{ color: "red" }}>{error}</p>}

                <label>Correo o usuario</label>
                <input
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    required
                    style={{ width: "100%" }}
                />

                <br /><br />

                <label>Contrasena</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: "100%" }}
                />

                <br /><br />

                <button type="submit">Ingresar</button>

                <p>
                    <Link to="/recuperar">Olvide mi contrasena</Link>
                </p>
            </form>
        </div>
    );
};
