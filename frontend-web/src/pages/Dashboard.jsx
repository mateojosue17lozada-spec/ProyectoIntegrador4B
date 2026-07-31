import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, Boxes, CalendarCheck, CircleDollarSign, Clock3, FileHeart,
  PackageSearch, ReceiptText, ShieldCheck, UserRoundCheck, Users, WalletCards,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { apiFetch } from "../services/api";

const ROLE_CONTENT = {
  Administrador: {
    eyebrow: "Control general",
    description: "Supervisa la operación, las alertas y el desempeño diario de la óptica.",
    metrics: [
      ["Ventas de hoy", "ventas_hoy", CircleDollarSign, "green"],
      ["Citas de hoy", "citas_hoy", CalendarCheck, "cyan"],
      ["Stock en mínimo", "stock_bajo", PackageSearch, "amber"],
      ["Atenciones de hoy", "atenciones_hoy", Activity, "violet"],
    ],
    actions: [["Gestionar usuarios", "/dashboard/usuarios", ShieldCheck], ["Revisar cartera", "/dashboard/cartera", WalletCards], ["Ver compras", "/dashboard/compras", Boxes]],
  },
  Optometra: {
    eyebrow: "Atención clínica",
    description: "Organiza la agenda clínica y continúa las atenciones pendientes.",
    metrics: [
      ["Citas de hoy", "citas_hoy", CalendarCheck, "cyan"],
      ["Por confirmar", "citas_pendientes", Clock3, "amber"],
      ["Atenciones realizadas", "atenciones_hoy", FileHeart, "violet"],
      ["Pacientes activos", "pacientes", Users, "blue"],
    ],
    actions: [["Abrir agenda", "/dashboard/citas", CalendarCheck], ["Iniciar atención", "/dashboard/examenes", Activity], ["Historias clínicas", "/dashboard/historias", FileHeart]],
  },
  Cajero: {
    eyebrow: "Operación financiera",
    description: "Controla cobros, facturación y el estado operativo de caja.",
    metrics: [
      ["Ventas de hoy", "ventas_hoy", CircleDollarSign, "green"],
      ["Pagos confirmados", "citas_pagadas", UserRoundCheck, "cyan"],
      ["Citas por confirmar", "citas_pendientes", Clock3, "amber"],
      ["Citas de hoy", "citas_hoy", CalendarCheck, "blue"],
    ],
    actions: [["Abrir caja", "/dashboard/caja", CircleDollarSign], ["Emitir factura", "/dashboard/facturacion", ReceiptText], ["Cobrar cartera", "/dashboard/cartera", WalletCards]],
  },
  Vendedor: {
    eyebrow: "Atención comercial",
    description: "Consulta disponibilidad y acompaña citas, pedidos y ventas permitidas.",
    metrics: [
      ["Citas de hoy", "citas_hoy", CalendarCheck, "cyan"],
      ["Pacientes activos", "pacientes", Users, "blue"],
      ["Stock en mínimo", "stock_bajo", PackageSearch, "amber"],
      ["Pagos confirmados", "citas_pagadas", UserRoundCheck, "green"],
    ],
    actions: [["Consultar inventario", "/dashboard/inventario", Boxes], ["Crear cita", "/dashboard/citas", CalendarCheck], ["Pedidos y recetas", "/dashboard/recetas", ReceiptText]],
  },
};

const RESTRICTED_CONTENT = {
  eyebrow: "Cuenta sin perfil operativo",
  description: "Tu cuenta no tiene un rol interno habilitado. Contacta a un administrador para revisar el acceso.",
  metrics: [],
  actions: [],
};

const formatMetric = (key, value) => key === "ventas_hoy" && value !== undefined
  ? new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value)
  : value ?? "—";

export const DashboardHome = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const content = ROLE_CONTENT[user?.rol] || RESTRICTED_CONTENT;
  useEffect(() => { apiFetch("/dashboard").then(setStats).catch((error) => setMessage(error.message)); }, []);
  return (
    <section className="module-page dashboard-page">
      <header className="hero-header">
        <div><span className="eyebrow">{content.eyebrow} · {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}</span><h1>Hola, {user?.nombre}</h1><p>{content.description}</p></div>
        <span className="role-badge">{user?.rol}</span>
      </header>
      {message && <div className="notice error" role="alert">{message}</div>}
      {!content.metrics.length && <div className="notice warning" role="status">No se muestran datos operativos para el rol {user?.rol || "sin asignar"}.</div>}
      <div className="metric-grid">
        {content.metrics.map(([label, key, Icon, tone]) => <article className="metric-card" key={key}><span className={`metric-icon ${tone}`}><Icon /></span><div><span>{label}</span><strong>{formatMetric(key, stats?.[key])}</strong></div></article>)}
      </div>
      <div className="dashboard-grid">
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Acciones frecuentes</span><h2>Continuar trabajando</h2></div></div><div className="role-actions">{content.actions.map(([label, to, Icon]) => <Link to={to} key={to}><Icon size={20}/><span>{label}</span><small>Abrir módulo</small></Link>)}</div></article>
        <article className="panel quick-panel"><span className="eyebrow">Situación del día</span><h2>Elementos que requieren atención</h2><div className="quick-stat"><strong>{stats?.citas_pendientes ?? "—"}</strong><span>Citas pendientes de confirmar</span></div><div className="quick-stat warning"><strong>{stats?.stock_bajo ?? "—"}</strong><span>Productos en stock mínimo</span></div></article>
      </div>
    </section>
  );
};

const formatDate = (value) => value ? new Date(value).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }) : "Sin registro";

export const DashboardProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ nombre: "", apellido: "", telefono: "", fecha_nacimiento: "" });
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const initials = useMemo(() => `${profile?.nombre?.[0] || ""}${profile?.apellido?.[0] || ""}`.toUpperCase() || "U", [profile]);
  useEffect(() => { apiFetch("/auth/profile").then((data) => { setProfile(data); setForm({ nombre: data.nombre || "", apellido: data.apellido || "", telefono: data.telefono || "", fecha_nacimiento: String(data.fecha_nacimiento || "").slice(0, 10) }); }).catch((error) => setNotice({ type: "error", text: error.message })); }, []);
  const save = async (event) => { event.preventDefault(); setSaving(true); try { const updated = await apiFetch("/auth/profile", { method: "PATCH", body: form }); setProfile((current) => ({ ...current, ...updated })); setNotice({ type: "success", text: "Tus datos personales se actualizaron correctamente." }); } catch (error) { setNotice({ type: "error", text: error.message }); } finally { setSaving(false); } };
  if (!profile) return <section className="module-page"><div className="panel">{notice.text || "Cargando perfil…"}</div></section>;
  return (
    <section className="module-page profile-page">
      <header className="profile-hero"><span className="profile-avatar" aria-hidden="true">{initials}</span><div><span className="eyebrow">Mi cuenta</span><h1>{profile.nombre} {profile.apellido}</h1><p>@{profile.usuario} · {profile.rol}</p></div><span className={`account-status ${profile.estado ? "active" : "inactive"}`}>{profile.estado ? "Cuenta activa" : "Cuenta inactiva"}</span></header>
      {notice.text && <div className={`notice ${notice.type}`} role="status">{notice.text}</div>}
      <div className="profile-grid">
        <form className="panel" onSubmit={save}><div className="panel-heading"><div><span className="eyebrow">Datos editables</span><h2>Información personal</h2></div></div><div className="field-grid"><label>Nombre *<input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}/></label><label>Apellido<input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })}/></label><label>Teléfono<input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}/></label><label>Fecha de nacimiento<input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}/></label></div><div className="locked-fields"><div><span>Correo</span><strong>{profile.correo}</strong><small>Solo un administrador puede modificarlo.</small></div><div><span>Usuario</span><strong>{profile.usuario}</strong><small>Identificador administrativo bloqueado.</small></div><div><span>Rol</span><strong>{profile.rol}</strong><small>Definido por permisos del sistema.</small></div></div><div className="form-actions"><button disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div></form>
        <aside className="profile-side"><article className="panel"><span className="eyebrow">Seguridad</span><h2>Acceso a la cuenta</h2><dl className="profile-facts"><div><dt>Último acceso</dt><dd>{formatDate(profile.ultimo_login)}</dd></div><div><dt>Sesiones activas</dt><dd>{profile.sesiones_activas ?? 0}</dd></div><div><dt>Contraseña</dt><dd>Protegida con hash seguro</dd></div></dl><p className="help-text">El cambio de contraseña se realiza mediante el flujo seguro de recuperación para revocar sesiones anteriores.</p></article><article className="panel"><span className="eyebrow">Actividad permitida</span><h2>Movimientos recientes</h2><div className="activity-list">{profile.actividad_reciente?.length ? profile.actividad_reciente.map((item, index) => <div key={`${item.fecha}-${index}`}><span>{item.accion.replaceAll("_", " ")}</span><small>{formatDate(item.fecha)}</small></div>) : <p className="help-text">No hay actividad reciente disponible.</p>}</div></article></aside>
      </div>
      <p className="profile-role-note">Contenido habilitado para el perfil <strong>{user?.rol}</strong>. Los módulos visibles se basan en permisos del backend.</p>
    </section>
  );
};
