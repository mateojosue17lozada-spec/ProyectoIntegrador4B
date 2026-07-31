import { useEffect, useState } from "react";
import { Glasses, KeyRound, Mail } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../../services/api";
import hero from "../../assets/optometry-login.png";

export default function RecuperarPassword() {
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState(""),
    [token, setToken] = useState(params.get("token") || ""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [message, setMessage] = useState(""),
    [tokenDev, setTokenDev] = useState("");
  useEffect(()=>{if(token)apiFetch(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`,{auth:false}).catch(error=>setMessage(error.message))},[token]);
  const request = async (event) => {
    event.preventDefault();
    try {
      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        auth: false,
        body: { identificador: identifier },
      });
      setMessage(data.mensaje);
      setTokenDev(data.resetToken || "");
    } catch (error) {
      setMessage(error.message);
    }
  };
  const reset = async (event) => {
    event.preventDefault();
    if(password!==confirm){setMessage("Las contraseñas no coinciden");return}
    try {
      const data = await apiFetch("/auth/reset-password", {
        method: "POST",
        auth: false,
        body: { token, password },
      });
      setMessage(data.mensaje);
      setPassword("");
      setConfirm("");
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <main
      className="login-page"
      style={{
        backgroundImage: `linear-gradient(90deg,rgba(3,19,35,.96),rgba(3,19,35,.7),rgba(3,19,35,.2)),url(${hero})`,
      }}
    >
      <section className="login-panel">
        <div className="login-brand">
          <span>
            <Glasses />
          </span>
          <div>
            <strong>Óptica Integral</strong>
            <small>Recuperación segura</small>
          </div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Seguridad de cuenta</span>
          <h1>{token ? "Crea una nueva clave" : "Recupera tu acceso"}</h1>
          <p>
            {token
              ? "Usa al menos 10 caracteres, mayúscula, minúscula y número."
              : "Te enviaremos un enlace de uso único con vigencia de 30 minutos."}
          </p>
        </div>
        {message && <div className="notice">{message}</div>}
        {tokenDev && (
          <div className="notice">
            Token de desarrollo: <strong>{tokenDev}</strong>
          </div>
        )}
        {!token ? (
          <form className="login-form" onSubmit={request}>
            <label>
              Usuario o correo
              <div className="input-icon">
                <Mail />
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </label>
            <button className="full">Enviar instrucciones</button>
          </form>
        ) : (
          <form className="login-form" onSubmit={reset}>
            <label>Token de recuperación<input required value={token} onChange={e=>setToken(e.target.value.trim())}/></label>
            <label>
              Nueva contraseña
              <div className="input-icon">
                <KeyRound />
                <input
                  required
                  minLength={10}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </label>
            <label>Confirmar contraseña<div className="input-icon"><KeyRound/><input required minLength={10} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></div></label>
            <button className="full">Actualizar contraseña</button>
          </form>
        )}
        <p className="login-footer">
          <Link to="/login">Volver al inicio de sesión</Link>
        </p>
      </section>
    </main>
  );
}
