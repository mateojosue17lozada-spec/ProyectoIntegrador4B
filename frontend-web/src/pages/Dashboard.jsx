import { useState } from "react";

import { useAuth } from "../hooks/useAuth";

export const DashboardHome = () => {
    const { user } = useAuth();

    return (
        <div>
            <h2>Bienvenido al sistema, {user?.nombre}</h2>
            <p>
                Usuario:<b> {user?.nombre}</b>
            </p>
            <p>
                Rol:<b> {user?.rol}</b>
            </p>
        </div>
    );
};

export const DashboardProfile = () => {
    const { user } = useAuth();

    return (
        <div>
            <h2>Perfil del Usuario</h2>
            <p>Nombre: {user?.nombre}</p>
            <p>Rol: {user?.rol}</p>
        </div>
    );
};

export const DashboardCalculator = () => {
    const [resultado, setResultado] = useState("");

    const calcular = () => {
        const valores = resultado.split("+").map((valor) => Number(valor.trim()));

        if (!resultado || valores.some((valor) => Number.isNaN(valor))) {
            setResultado("Error");
            return;
        }

        setResultado(String(valores.reduce((total, valor) => total + valor, 0)));
    };

    return (
        <div>
            <h2>Calculadora</h2>
            <input value={resultado} readOnly />
            <div>
                <button onClick={() => setResultado(resultado + "1")}>1</button>
                <button onClick={() => setResultado(resultado + "2")}>2</button>
                <button onClick={() => setResultado(resultado + "3")}>3</button>
                <button onClick={() => setResultado(resultado + "+")}>+</button>
                <button onClick={calcular}>=</button>
                <button onClick={() => setResultado("")}>C</button>
            </div>
        </div>
    );
};
