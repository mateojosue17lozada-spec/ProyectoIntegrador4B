import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, Boxes, CalendarDays, ClipboardPlus, CreditCard, FileText, Glasses,
    LayoutDashboard, LogOut, Menu, ReceiptText, ShoppingCart, Stethoscope, Users, WalletCards, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const items = [
    {to:"/dashboard",label:"Resumen",icon:LayoutDashboard,roles:["Administrador","Optometra","Cajero","Vendedor"],end:true},
    {to:"/dashboard/pacientes",label:"Pacientes",icon:Users,roles:["Administrador","Optometra","Cajero","Vendedor"]},
    {to:"/dashboard/citas",label:"Agenda y pagos",icon:CalendarDays,roles:["Administrador","Optometra","Cajero","Vendedor"]},
    {to:"/dashboard/examenes",label:"Examen visual",icon:Activity,roles:["Administrador","Optometra"]},
    {to:"/dashboard/historias",label:"Historia clínica",icon:Stethoscope,roles:["Administrador","Optometra"]},
    {to:"/dashboard/recetas",label:"Recetas y laboratorio",icon:Glasses,roles:["Administrador","Optometra","Vendedor"]},
    {to:"/dashboard/inventario",label:"Inventario",icon:Boxes,roles:["Administrador","Cajero","Vendedor"]},
    {to:"/dashboard/compras",label:"Compras",icon:ShoppingCart,roles:["Administrador"]},
    {to:"/dashboard/facturacion",label:"Facturación",icon:ReceiptText,roles:["Administrador","Cajero"]},
    {to:"/dashboard/caja",label:"Caja",icon:CreditCard,roles:["Administrador","Cajero"]},
    {to:"/dashboard/cartera",label:"Cartera",icon:WalletCards,roles:["Administrador","Cajero"]},
    {to:"/dashboard/usuarios",label:"Usuarios y auditoría",icon:ClipboardPlus,roles:["Administrador"]}
];

export const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [open,setOpen] = useState(false);
    const current = items.find((item) => location.pathname === item.to)?.label || "Óptica Integral";
    const cerrar = async () => { await logout(); navigate("/login"); };
    return <div className="app-shell">
        <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
            <div className="brand"><span className="brand-mark"><Glasses size={24}/></span><div><strong>Óptica Integral</strong><small>Gestión clínica</small></div><button className="icon-button sidebar-close" onClick={()=>setOpen(false)}><X/></button></div>
            <div className="identity"><span className="avatar">{user?.nombre?.slice(0,1)?.toUpperCase()}</span><div><strong>{user?.nombre}</strong><span>{user?.rol}</span></div></div>
            <nav>{items.filter((item)=>item.roles.includes(user?.rol)).map(({icon:Icon,...item})=><NavLink key={item.to} to={item.to} end={item.end} onClick={()=>setOpen(false)}><Icon size={19}/><span>{item.label}</span></NavLink>)}</nav>
            <button className="logout-button" onClick={cerrar}><LogOut size={18}/>Cerrar sesión</button>
        </aside>
        {open && <button aria-label="Cerrar menú" className="sidebar-backdrop" onClick={()=>setOpen(false)}/>}
        <div className="workspace">
            <header className="topbar"><button className="icon-button menu-toggle" onClick={()=>setOpen(true)}><Menu/></button><div><span>Panel de gestión</span><strong>{current}</strong></div><FileText size={20}/></header>
            <main className="content"><Outlet/></main>
        </div>
    </div>;
};
