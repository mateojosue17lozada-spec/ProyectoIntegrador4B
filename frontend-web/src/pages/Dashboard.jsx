import { useEffect, useState } from "react";
import { Activity, CalendarCheck, CircleDollarSign, PackageSearch, UserRoundCheck, Users } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { apiFetch } from "../services/api";

export const DashboardHome = () => {
    const { user } = useAuth();
    const [stats,setStats] = useState(null);
    const [message,setMessage] = useState("");
    useEffect(()=>{ apiFetch("/dashboard").then(setStats).catch((error)=>setMessage(error.message)); },[]);
    const cards = [
        ["Pacientes activos",stats?.pacientes,Users,"blue"],
        ["Citas de hoy",stats?.citas_hoy,CalendarCheck,"cyan"],
        ["Pagos confirmados",stats?.citas_pagadas,UserRoundCheck,"green"],
        ["Atenciones de hoy",stats?.atenciones_hoy,Activity,"violet"],
        ["Productos con alerta",stats?.stock_bajo,PackageSearch,"amber"]
    ];
    if (stats?.ventas_hoy !== undefined) cards.push(["Ventas de hoy",`$${stats.ventas_hoy.toFixed(2)}`,CircleDollarSign,"green"]);
    return <section className="module-page dashboard-page">
        <header className="hero-header"><div><span className="eyebrow">{new Date().toLocaleDateString("es-EC",{weekday:"long",day:"numeric",month:"long"})}</span><h1>Hola, {user?.nombre}</h1><p>Este es el pulso operativo de tu óptica hoy.</p></div><div className="status-pill"><span/>Sistema operativo</div></header>
        {message && <div className="notice error">{message}</div>}
        <div className="metric-grid">{cards.map(([label,value,Icon,tone])=><article className="metric-card" key={label}><span className={`metric-icon ${tone}`}><Icon/></span><div><span>{label}</span><strong>{value ?? "—"}</strong></div></article>)}</div>
        <div className="dashboard-grid"><article className="panel"><div className="panel-heading"><div><span className="eyebrow">Flujo clínico</span><h2>Atención segura</h2></div><span className="status-pill"><span/>Activo</span></div><div className="flow-track">{["Paciente","Cita","Pago","Atención","Historia","Receta"].map((step,index)=><div key={step}><span>{index+1}</span><strong>{step}</strong></div>)}</div></article><article className="panel quick-panel"><span className="eyebrow">Pendientes</span><h2>Enfoque del día</h2><div className="quick-stat"><strong>{stats?.citas_pendientes ?? "—"}</strong><span>Citas pendientes de confirmar</span></div><div className="quick-stat warning"><strong>{stats?.stock_bajo ?? "—"}</strong><span>Productos en stock mínimo</span></div></article></div>
    </section>;
};

export const DashboardProfile = () => { const { user }=useAuth(); return <section className="module-page"><header className="page-header"><div><span className="eyebrow">Mi cuenta</span><h1>Perfil</h1><p>{user?.nombre} · {user?.rol}</p></div></header></section>; };
