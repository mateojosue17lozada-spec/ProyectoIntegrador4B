import { useState } from "react";
import { Eye, EyeOff, Glasses, LockKeyhole, UserRound } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import hero from "../assets/optometry-login.png";

export const Login = () => {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [form,setForm] = useState({ identificador:"", password:"" });
    const [show,setShow] = useState(false);
    const [message,setMessage] = useState("");
    const [loading,setLoading] = useState(false);
    if (user) return <Navigate to="/dashboard" replace/>;
    const submit = async (event) => {
        event.preventDefault(); setLoading(true); setMessage("");
        const result = await login(form.identificador, form.password);
        setLoading(false);
        if (result.ok) navigate("/dashboard"); else setMessage(result.mensaje);
    };
    return <main className="login-page" style={{backgroundImage:`linear-gradient(90deg,rgba(3,19,35,.96) 0%,rgba(3,19,35,.82) 35%,rgba(3,19,35,.18) 70%),url(${hero})`}}>
        <section className="login-panel">
            <div className="login-brand"><span><Glasses/></span><div><strong>Óptica Integral</strong><small>Salud visual, mejor gestionada</small></div></div>
            <div className="login-copy"><span className="eyebrow">Acceso seguro</span><h1>Bienvenido de nuevo</h1><p>Gestiona pacientes, atención clínica y operación comercial desde un solo lugar.</p></div>
            <form className="login-form" onSubmit={submit}>
                {message && <div className="notice error" role="alert">{message}</div>}
                <label>Usuario o correo<div className="input-icon"><UserRound/><input autoFocus autoComplete="username" value={form.identificador} onChange={(e)=>setForm({...form,identificador:e.target.value})} placeholder="nombre@clinica.com" required/></div></label>
                <label>Contraseña<div className="input-icon"><LockKeyhole/><input type={show?"text":"password"} autoComplete="current-password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="••••••••••" required/><button type="button" className="password-toggle" onClick={()=>setShow(!show)} aria-label="Mostrar contraseña">{show?<EyeOff/>:<Eye/>}</button></div></label>
                <div className="login-options"><span>Sesión protegida por JWT</span><Link to="/recuperar">¿Olvidaste tu contraseña?</Link></div>
                <button className="primary-button full" disabled={loading}>{loading?"Verificando…":"Ingresar al sistema"}</button>
            </form>
            <p className="login-footer">Acceso exclusivo para personal autorizado</p>
        </section>
    </main>;
};
