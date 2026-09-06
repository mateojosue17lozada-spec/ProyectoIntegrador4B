import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Save } from "lucide-react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function RolesPermisos() {
    const { usuario } = useAuth();
    const esAdmin = usuario?.rol === "Administrador";

    const [data, setData] = useState({ roles: [], modulos: [], permisosPorRol: [] });
    const [matriz, setMatriz] = useState({});
    const [message, setMessage] = useState("");
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        apiFetch("/roles-permisos")
            .then((res) => {
                setData(res);
                // Inicializar matriz editable
                const inicial = {};
                res.modulos.forEach((permiso) => {
                    const clave = `${permiso.modulo}:${permiso.accion}`;
                    inicial[clave] = [...(permiso.roles || [])];
                });
                setMatriz(inicial);
            })
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

    const togglePermiso = (clave, rol) => {
        if (!esAdmin) return;
        setMatriz((prev) => {
            const actuales = prev[clave] || [];
            const existe = actuales.includes(rol);
            const nuevos = existe ? actuales.filter((r) => r !== rol) : [...actuales, rol];
            return { ...prev, [clave]: nuevos };
        });
    };

    const handleGuardar = async () => {
        if (!esAdmin) return;
        setGuardando(true);
        setMessage("");
        try {
            await apiFetch("/roles-permisos/guardar", {
                method: "POST",
                body: { matrizPermisos: matriz },
            });
            setMessage("✓ Permisos de roles actualizados exitosamente.");
        } catch (err) {
            setMessage(err.message || "Error al guardar permisos.");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="module-page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Control de acceso</span>
                    <h1>Roles y permisos</h1>
                    <p>Matriz interactiva de control de acceso basada en roles.</p>
                </div>
                {esAdmin && (
                    <button onClick={handleGuardar} disabled={guardando} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Save size={18} />
                        {guardando ? "Guardando…" : "Guardar permisos"}
                    </button>
                )}
            </header>

            {message && (
                <div className={`notice ${message.startsWith("✓") ? "success" : "error"}`}>
                    {message}
                </div>
            )}

            <div className="summary-grid">
                {data.roles.map((rol) => (
                    <article key={rol.id_rol || rol.nombre_rol}>
                        <span>{rol.nombre_rol}</span>
                        <strong style={{ fontSize: 16 }}>{rol.descripcion || "Rol del sistema"}</strong>
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
                                    <th>Acción / Permiso</th>
                                    {roles.map((rol) => <th key={rol}>{rol}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {data.modulos
                                    .filter((permiso) => permiso.modulo === modulo)
                                    .map((permiso) => {
                                        const clave = `${permiso.modulo}:${permiso.accion}`;
                                        const rolesAsignados = matriz[clave] || [];
                                        return (
                                            <tr key={clave}>
                                                <td><strong>{permiso.accion}</strong></td>
                                                {roles.map((rol) => {
                                                    const activo = rolesAsignados.includes(rol);
                                                    return (
                                                        <td key={rol} style={{ textAlign: "center" }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={activo}
                                                                disabled={!esAdmin}
                                                                onChange={() => togglePermiso(clave, rol)}
                                                                style={{ width: 18, height: 18, cursor: esAdmin ? "pointer" : "default" }}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </section>
    );
}
