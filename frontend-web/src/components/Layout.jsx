import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    Activity,
    Boxes,
    CalendarDays,
    ClipboardPlus,
    CreditCard,
    Glasses,
    LayoutDashboard,
    LogOut,
    Menu,
    UserRound,
    ReceiptText,
    ShieldCheck,
    ShoppingCart,
    Stethoscope,
    Users,
    WalletCards,
    X
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const items = [
    { group: "Atención", to: "/dashboard", label: "Resumen", icon: LayoutDashboard, roles: ["Administrador", "Optometra", "Cajero", "Vendedor"], end: true },
    { group: "Atención", to: "/dashboard/citas", label: "Agenda y pagos", icon: CalendarDays, roles: ["Administrador", "Optometra", "Cajero", "Vendedor"] },
    { group: "Atención", to: "/dashboard/pacientes", label: "Pacientes", icon: Users, roles: ["Administrador", "Optometra", "Cajero", "Vendedor"] },
    { group: "Atención", to: "/dashboard/examenes", label: "Examen visual", icon: Activity, roles: ["Administrador", "Optometra"] },
    { group: "Atención", to: "/dashboard/historias", label: "Historia clínica", icon: Stethoscope, roles: ["Administrador", "Optometra"] },
    { group: "Operación", to: "/dashboard/recetas", label: "Recetas y laboratorio", icon: Glasses, roles: ["Administrador", "Optometra", "Vendedor"] },
    { group: "Operación", to: "/dashboard/inventario", label: "Inventario", icon: Boxes, roles: ["Administrador", "Cajero", "Vendedor"] },
    { group: "Administración", to: "/dashboard/facturacion", label: "Facturación", icon: ReceiptText, roles: ["Administrador", "Cajero"] },
    { group: "Administración", to: "/dashboard/caja", label: "Caja", icon: CreditCard, roles: ["Administrador", "Cajero"] },
    { group: "Administración", to: "/dashboard/compras", label: "Compras", icon: ShoppingCart, roles: ["Administrador"] },
    { group: "Administración", to: "/dashboard/cartera", label: "Cartera", icon: WalletCards, roles: ["Administrador", "Cajero"] },
    { group: "Control", to: "/dashboard/usuarios", label: "Usuarios y auditoría", icon: ClipboardPlus, roles: ["Administrador"] },
    { group: "Control", to: "/dashboard/roles-permisos", label: "Roles y permisos", icon: ShieldCheck, roles: ["Administrador"] }
];

export const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const current = items.find((item) => location.pathname === item.to)?.label || "Optica Integral";
    const visibleItems = items.filter((item) => item.roles.includes(user?.rol));
    const groups = [...new Set(visibleItems.map((item) => item.group))];
    const cerrar = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="app-shell">
            <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
                <div className="brand">
                    <span className="brand-mark"><Glasses size={24} /></span>
                    <div>
                        <strong>Optica Integral</strong>
                        <small>Gestion clinica</small>
                    </div>
                    <button className="icon-button sidebar-close" onClick={() => setOpen(false)}><X /></button>
                </div>
                <div className="identity">
                    <span className="avatar">{user?.nombre?.slice(0, 1)?.toUpperCase()}</span>
                    <div>
                        <strong>{user?.nombre}</strong>
                        <span>{user?.rol}</span>
                    </div>
                </div>
                <nav>
                    {groups.map((group) => <div className="nav-group" key={group}><span className="nav-group-label">{group}</span>{visibleItems.filter((item) => item.group === group).map(({ icon: Icon, ...item }) => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}><Icon size={19}/><span>{item.label}</span></NavLink>)}</div>)}
                </nav>
                <button className="logout-button" onClick={cerrar}><LogOut size={18} />Cerrar sesion</button>
            </aside>
            {open && <button aria-label="Cerrar menu" className="sidebar-backdrop" onClick={() => setOpen(false)} />}
            <div className="workspace">
                <header className="topbar">
                    <button className="icon-button menu-toggle" onClick={() => setOpen(true)}><Menu /></button>
                    <div>
                        <span className="breadcrumbs"><NavLink to="/dashboard">Panel de gestión</NavLink><b>/</b>{current}</span>
                        <strong>{current}</strong>
                    </div>
                    <NavLink className="profile-link" to="/dashboard/perfil" aria-label="Abrir mi perfil"><UserRound size={18}/><span>{user?.nombre}</span></NavLink>
                </header>
                <main className="content"><Outlet /></main>
            </div>
        </div>
    );
};
