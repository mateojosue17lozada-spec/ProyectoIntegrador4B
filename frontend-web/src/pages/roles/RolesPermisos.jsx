import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { apiFetch } from "../../services/api";

export default function RolesPermisos() {
    const [data, setData] = useState({ roles: [], modulos: [], permisosPorRol: [] });
    const [message, setMessage] = useState("");

    useEffect(() => {
        apiFetch("/roles-permisos")
            .then(setData)
            .catch((error) => setMessage(error.message));
    }, []);

    const roles = useMemo(
        () => data.roles.map((rol) => rol.nombre_rol),
        [data.roles]
    );

    const modulos = useMemo(
        () => [...new Set(data.modulos.map((permiso) => permiso.modulo))],
        [data.modulos]
    );

    const tienePermiso = (permiso, rol) => permiso.roles.includes(rol);

    return (
        <section className="module-page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Control de acceso</span>
                    <h1>Roles y permisos</h1>
                    <p>Matriz operativa basada en las reglas activas del backend.</p>
                </div>
                <ShieldCheck size={28} />
            </header>

            {message && <div className="notice">{message}</div>}

            <div className="summary-grid">
                {data.roles.map((rol) => (
                    <article key={rol.id_rol || rol.nombre_rol}>
                        <span>{rol.nombre_rol}</span>
                        <strong style={{ fontSize: 16 }}>{rol.descripcion || "Sin descripcion"}</strong>
                    </article>
                ))}
            </div>

            {modulos.map((modulo) => (
                <section className="clinical-section" key={modulo}>
                    <h2>{modulo}</h2>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Permiso</th>
                                    {roles.map((rol) => <th key={rol}>{rol}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {data.modulos
                                    .filter((permiso) => permiso.modulo === modulo)
                                    .map((permiso) => (
                                        <tr key={`${permiso.modulo}-${permiso.accion}`}>
                                            <td>{permiso.accion}</td>
                                            {roles.map((rol) => (
                                                <td key={rol}>
                                                    {tienePermiso(permiso, rol) ? "Permitido" : "No permitido"}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </section>
    );
}
