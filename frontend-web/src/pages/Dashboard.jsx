import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, Boxes, CalendarCheck, CircleDollarSign, Clock3, FileHeart,
  PackageSearch, ReceiptText, ShieldCheck, UserRoundCheck, Users, WalletCards,
  ShoppingBag, CalendarDays, CheckCircle, XCircle, Download, QrCode,
  ChevronLeft, ChevronRight, Search, Scan
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { apiFetch } from "../services/api";
import { QRCodeSVG } from "qrcode.react";
import jsQR from "jsqr";

// Obtener la fecha actual en zona horaria local, formateada como YYYY-MM-DD
const getLocalToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ------------------------------------------------------------
// CONTENIDO PARA ROLES NO PACIENTES (COMPLETO)
// ------------------------------------------------------------
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
    actions: [
      ["Gestionar usuarios", "/dashboard/usuarios", ShieldCheck],
      ["Revisar cartera", "/dashboard/cartera", WalletCards],
      ["Ver compras", "/dashboard/compras", Boxes],
      ["Escanear pedido", "#", Scan]
    ],
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
    actions: [
      ["Abrir agenda", "/dashboard/citas", CalendarCheck],
      ["Iniciar atención", "/dashboard/examenes", Activity],
      ["Historias clínicas", "/dashboard/historias", FileHeart]
    ],
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
    actions: [
      ["Abrir caja", "/dashboard/caja", CircleDollarSign],
      ["Emitir factura", "/dashboard/facturacion", ReceiptText],
      ["Cobrar cartera", "/dashboard/cartera", WalletCards],
      ["Escanear pedido", "#", Scan]
    ],
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
    actions: [
      ["Consultar inventario", "/dashboard/inventario", Boxes],
      ["Crear cita", "/dashboard/citas", CalendarCheck],
      ["Pedidos y recetas", "/dashboard/recetas", ReceiptText]
    ],
  },
};

const RESTRICTED_CONTENT = {
  eyebrow: "Cuenta sin perfil operativo",
  description: "Tu cuenta no tiene un rol interno habilitado. Contacta a un administrador para revisar el acceso.",
  metrics: [],
  actions: [],
};

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------
const formatMetric = (key, value) =>
  key === "ventas_hoy" && value !== undefined
    ? new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value)
    : value ?? "—";
const formatDate = (value, opts = {}) => {
  if (!value) return "Sin registro";

  let dateObj;
  if (typeof value === "string" && !value.endsWith("Z") && !value.includes("+") && value.includes("T")) {
    const [d, t] = value.split("T");
    const [y, m, day] = d.split("-").map(Number);
    const [h, min, s] = (t || "00:00:00").split(":").map(Number);
    dateObj = new Date(y, m - 1, day, h || 0, min || 0, s || 0);
  } else {
    dateObj = new Date(value);
  }

  if (isNaN(dateObj.getTime())) {
    console.warn('formatDate: fecha inválida', value);
    return String(value);
  }

  const defaultOpts = {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  };

  const finalOpts = { ...defaultOpts, ...opts };
  if (opts.dateStyle && !opts.timeStyle) delete finalOpts.timeStyle;

  try {
    return dateObj.toLocaleString("es-EC", finalOpts);
  } catch (e) {
    return dateObj.toISOString();
  }
};
const ESTADO_CITA = {
  Pendiente: { color: "amber", icon: <Clock3 size={14} /> },
  Confirmada: { color: "cyan", icon: <CalendarCheck size={14} /> },
  Atendida: { color: "green", icon: <CheckCircle size={14} /> },
  Cancelada: { color: "red", icon: <XCircle size={14} /> },
  "No asistio": { color: "red", icon: <XCircle size={14} /> },
};
// ------------------------------------------------------------
// COMPONENTE: LECTOR QR (con jsQR y botón de activación manual)
// ------------------------------------------------------------
const LectorQR = ({ onClose, onScanSuccess }) => {
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const mountedRef = useRef(true);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setIsScanning(true);
        scanLoop();
      }
    } catch (err) {
      setError("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  };

  const scanLoop = () => {
    if (!mountedRef.current || !videoRef.current || !canvasRef.current) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code && code.data) {
        // Detener cámara y notificar
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setIsScanning(false);
        setCameraActive(false);
        if (mountedRef.current) onScanSuccess(code.data);
        return;
      }
    }
    animationRef.current = requestAnimationFrame(scanLoop);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const handleCancel = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="drawer-backdrop" onMouseDown={handleCancel}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "600px", width: "100%" }}
      >
        <header>
          <div>
            <span className="eyebrow">Escanear QR</span>
            <h2>Lector de pedidos</h2>
          </div>
          <button className="icon-button secondary" onClick={handleCancel} aria-label="Cerrar">✕</button>
        </header>
        <div style={{ padding: "1rem 0" }}>
          {error && <div className="notice error">{error}</div>}
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              margin: "0 auto",
              border: "1px solid #eaeaea",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#000",
              position: "relative",
            }}
          >
            <video
              ref={videoRef}
              style={{ width: "100%", height: "auto", display: "block" }}
              playsInline
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>

          {!cameraActive && !error && (
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button className="primary" onClick={startCamera}>
                📷 Activar cámara
              </button>
              <p style={{ color: "var(--text-light)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                Haz clic en el botón para iniciar el escáner.
              </p>
            </div>
          )}

          {isScanning && (
            <p style={{ textAlign: "center", color: "var(--text-light)", marginTop: "1rem" }}>
              Escaneando... Coloca el QR frente a la cámara.
            </p>
          )}

          {cameraActive && !isScanning && !error && (
            <p style={{ textAlign: "center", color: "var(--success-color)", marginTop: "1rem" }}>
              ✅ Código escaneado correctamente.
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
            <button className="secondary" onClick={handleCancel}>Cancelar</button>
          </div>
        </div>
      </aside>
    </div>
  );
};
// ------------------------------------------------------------
// COMPONENTE: COMPROBANTE DE PEDIDO (con QR)
// ------------------------------------------------------------
const ComprobantePedido = ({ pedido, onClose }) => {
  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
  const isCompletado = pedido.estado === "COMPLETADO";
  const qrUrl = isCompletado ? null : `${window.location.origin}/dashboard/facturacion?pedido=${pedido.id_pedido}`;

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "600px", width: "100%" }}>
        <header>
          <div>
            <span className="eyebrow">Comprobante de pedido</span>
            <h2>Pedido #{pedido.id_pedido}</h2>
          </div>
          <button className="icon-button secondary" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div style={{ padding: "1rem 0" }}>
          {/* Info del pedido */}
          <div style={{ background: "#f8f9fa", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid #eaeaea" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div><strong>Fecha:</strong><p style={{ margin: "0.25rem 0", color: "#495057" }}>{formatDate(pedido.fecha_solicitud)}</p></div>
              <div><strong>Total:</strong><p style={{ margin: "0.25rem 0", fontSize: "1.5rem", fontWeight: "700", color: "#0f3460" }}>{fmt(pedido.total)}</p></div>
              <div><strong>Estado:</strong><span style={{ display: "inline-block", padding: "0.2rem 0.8rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: "600", background: isCompletado ? "rgba(34,197,94,0.15)" : "rgba(251,191,36,0.15)", color: isCompletado ? "#15803d" : "#b45309" }}>{pedido.estado}</span></div>
              <div><strong>Productos:</strong><p style={{ margin: "0.25rem 0", color: "#495057" }}>{pedido.detalles?.length || 0} items</p></div>
            </div>
          </div>

          {/* QR o mensaje de completado */}
          {isCompletado ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "1.5rem",
              background: "#f0fdf4",
              borderRadius: "12px",
              border: "1px solid #bbf7d0",
              marginBottom: "1.5rem"
            }}>
              <CheckCircle size={48} color="#15803d" />
              <p style={{ marginTop: "0.5rem", fontSize: "1rem", fontWeight: "600", color: "#15803d" }}>
                Pedido ya procesado y facturado
              </p>
              <p style={{ fontSize: "0.85rem", color: "#6c757d", textAlign: "center" }}>
                No se requiere escaneo. El pedido ya fue completado.
              </p>
            </div>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "1.5rem",
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #eaeaea",
              marginBottom: "1.5rem"
            }}>
              <QRCodeSVG value={qrUrl} size={180} level="H" includeMargin={true} />
              <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#6c757d", textAlign: "center" }}>
                Escanea este código para que el cajero<br />
                acceda directamente a tu pedido.
              </p>
            </div>
          )}

          {/* Detalle de productos */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>Productos</h3>
            <div style={{ border: "1px solid #eaeaea", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", fontSize: "0.9rem" }}>
                <thead style={{ background: "#f8f9fa" }}>
                  <tr><th style={{ padding: "0.5rem", textAlign: "left" }}>Producto</th><th style={{ padding: "0.5rem", textAlign: "center" }}>Cantidad</th><th style={{ padding: "0.5rem", textAlign: "right" }}>Precio</th></tr>
                </thead>
                <tbody>
                  {pedido.detalles?.map((d, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #eaeaea" }}>
                      <td style={{ padding: "0.5rem" }}>{d.nombre_producto || `Producto #${d.id_producto}`}{d.sku && <small style={{ display: "block", color: "#6c757d" }}>SKU: {d.sku}</small>}</td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>{d.cantidad}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{fmt(d.precio_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mensaje instructivo */}
          <div style={{
            background: isCompletado ? "#f8f9fa" : "#e8f5e9",
            borderRadius: "12px",
            padding: "1.5rem",
            border: isCompletado ? "1px solid #eaeaea" : "1px solid #c8e6c9",
            marginBottom: "1.5rem"
          }}>
            <CheckCircle size={24} color={isCompletado ? "#6c757d" : "#2e7d32"} style={{ marginBottom: "0.5rem" }} />
            <p style={{ margin: 0, color: isCompletado ? "#6c757d" : "#1e4620", fontWeight: "500" }}>
              {isCompletado
                ? "Este pedido ya fue completado y facturado. No requiere acción adicional."
                : "Próximo paso: Acércate a la óptica con este comprobante (físico o digital) para confirmar tu receta, realizar el pago y retirar tus productos."}
            </p>
          </div>

          {/* Botones */}
          <div style={{ display: "flex", gap: "1rem" }}>
            <button onClick={handleImprimir} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              <Download size={18} /> Imprimir / Guardar
            </button>
            <button className="secondary" onClick={onClose} style={{ flex: 1 }}>Cerrar</button>
          </div>
        </div>
      </aside>
    </div>
  );
};

// ------------------------------------------------------------
// DASHBOARD DEL PACIENTE (completo)
// ------------------------------------------------------------
const PacienteDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [citas, setCitas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ text: "", type: "" });
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [comprobantePedido, setComprobantePedido] = useState(null);

  // Paginación y filtros
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");

  // Modal Agendar
  const [agendando, setAgendando] = useState(false);
  const [nuevaCita, setNuevaCita] = useState({ id_usuario: "", fecha_cita: "", hora_cita: "", motivo: "", consultorio: "Consultorio 1" });
  const [guardando, setGuardando] = useState(false);

  // Filtros historial citas
  const [filtroCitas, setFiltroCitas] = useState("");
  const [filtroCitaEstado, setFiltroCitaEstado] = useState("");
  const [filtroCitaFecha, setFiltroCitaFecha] = useState("");

  // Modal Reagendar
  const [reagendando, setReagendando] = useState(null);
  const [reagendarForm, setReagendarForm] = useState({ fecha_cita: "", hora_cita: "" });

  const todayStr = getLocalToday();

  const cargar = async () => {
    try {
      const [c, p, prof] = await Promise.all([
        apiFetch("/citas/mis-citas").catch(() => []),
        apiFetch("/facturacion/mis-pedidos").catch(() => []),
        apiFetch("/citas/profesionales").catch(() => []),
      ]);
      setCitas(c);
      setPedidos(p);
      setProfesionales(prof);
    } catch (error) {
      console.error("Error cargando datos del paciente:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const pedidosFiltrados = useMemo(() => {
    let filtered = pedidos;
    if (filtroTexto.trim()) {
      const term = filtroTexto.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.detalles?.some(d =>
          d.nombre_producto?.toLowerCase().includes(term) ||
          d.sku?.toLowerCase().includes(term) ||
          d.codigo_barra?.toLowerCase().includes(term)
        )
      );
    }
    if (filtroFecha) {
      const fechaLocal = new Date(filtroFecha + 'T00:00:00');
      const fechaLocalStr = fechaLocal.toISOString().slice(0, 10); // ya en UTC
      // O mejor: comparar usando la fecha sin hora
      filtered = filtered.filter(p => {
        const fechaPedido = new Date(p.fecha_solicitud);
        return fechaPedido.toISOString().slice(0, 10) === fechaLocalStr;
      });
    }
    return filtered;
  }, [pedidos, filtroTexto, filtroFecha]);

  const totalPages = Math.ceil(pedidosFiltrados.length / pageSize);
  const pedidosPaginados = pedidosFiltrados.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filtroTexto, filtroFecha]);

const handleAgendar = async (e) => {
  e.preventDefault();
  setGuardando(true);
  setNotice({ text: "", type: "" });
  try {
    // Convertir fecha y hora seleccionadas (en zona local) a UTC
    const fechaLocal = nuevaCita.fecha_cita;
    const horaLocal = nuevaCita.hora_cita;
    // Construir objeto Date en local (se interpreta como local)
    const fechaHoraLocal = new Date(`${fechaLocal}T${horaLocal}:00`);
    // Calcular el timestamp en UTC (restando el offset local)
    const fechaHoraUTC = new Date(fechaHoraLocal.getTime() - fechaHoraLocal.getTimezoneOffset() * 60000);
    // Extraer fecha y hora en formato UTC (YYYY-MM-DD y HH:MM)
    const fechaUTC = fechaHoraUTC.toISOString().slice(0, 10);
    const horaUTC = fechaHoraUTC.toISOString().slice(11, 16);

    // Enviar al backend con los valores en UTC
    await apiFetch("/citas/mis-citas", {
      method: "POST",
      body: {
        ...nuevaCita,
        fecha_cita: fechaUTC,
        hora_cita: horaUTC,
      },
    });

    setNotice({ text: "¡Tu cita ha sido agendada con éxito!", type: "success" });
    setAgendando(false);
    setNuevaCita({
      id_usuario: "",
      fecha_cita: "",
      hora_cita: "",
      motivo: "",
      consultorio: "Consultorio 1",
    });
    await cargar();
  } catch (err) {
    setNotice({ text: err.message || "Error al agendar cita", type: "error" });
  } finally {
    setGuardando(false);
  }
};  const handleCancelar = async (id_cita) => {
    if (!window.confirm("¿Estás seguro de que deseas cancelar esta cita?")) return;
    try {
      await apiFetch(`/citas/mis-citas/${id_cita}/cancelar`, { method: "POST", body: { motivo: "Cancelada por paciente" } });
      setNotice({ text: "La cita fue cancelada correctamente.", type: "success" });
      await cargar();
    } catch (err) {
      setNotice({ text: err.message || "Error al cancelar la cita", type: "error" });
    }
  };

  const handleReagendar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setNotice({ text: "", type: "" });
    try {
      await apiFetch(`/citas/mis-citas/${reagendando.id_cita}/reagendar`, { method: "POST", body: reagendarForm });
      setNotice({ text: "La cita fue reagendada con éxito.", type: "success" });
      setReagendando(null);
      await cargar();
    } catch (err) {
      setNotice({ text: err.message || "Error al reagendar cita", type: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;

  // Comparar localmente: construir Date sin zona (local) para evitar desfase UTC
  const ahora = new Date();
  const proxima = citas
    .filter((c) => ["Pendiente", "Confirmada"].includes(c.estado))
    .filter((c) => {
      const [y, m, d] = c.fecha_cita.slice(0, 10).split("-").map(Number);
      const [h, min] = c.hora_cita.slice(0, 5).split(":").map(Number);
      return new Date(y, m - 1, d, h, min) >= ahora;
    })
    .sort((a, b) => {
      const [ay, am, ad] = a.fecha_cita.slice(0, 10).split("-").map(Number);
      const [ah, amin] = a.hora_cita.slice(0, 5).split(":").map(Number);
      const [by, bm, bd] = b.fecha_cita.slice(0, 10).split("-").map(Number);
      const [bh, bmin] = b.hora_cita.slice(0, 5).split(":").map(Number);
      return new Date(ay, am - 1, ad, ah, amin) - new Date(by, bm - 1, bd, bh, bmin);
    })[0] || null;

  // Slots de hora disponibles (08:00 a 18:00 cada 30 min)
  const TIME_SLOTS = [];
  for (let h = 8; h <= 17; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
  }
  TIME_SLOTS.push("18:00");

  return (
    <section className="module-page dashboard-page">
      <header className="hero-header">
        <div>
          <span className="eyebrow">Mi área · {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1>Hola, {user?.nombre} 👋</h1>
          <p>Gestiona tus citas clínicas y consulta el estado de tus pedidos.</p>
        </div>
        <span className="role-badge">Paciente</span>
      </header>

      {notice.text && (
        <div className={`notice ${notice.type}`} onClick={() => setNotice({ text: "", type: "" })} role="alert">
          {notice.text}
        </div>
      )}

      <div className="metric-grid">
        <article className="metric-card" onClick={() => setAgendando(true)} style={{ cursor: "pointer" }}>
          <span className="metric-icon violet"><CalendarDays /></span>
          <div><span>Mis citas</span><strong>{loading ? "…" : citas.length}</strong><small>Haz clic para agendar</small></div>
        </article>
        <article className="metric-card">
          <span className="metric-icon amber"><ShoppingBag /></span>
          <div><span>Pedidos pendientes</span><strong>{loading ? "…" : pedidos.filter(p => p.estado === "PENDIENTE").length}</strong></div>
        </article>
        <article className="metric-card">
          <span className="metric-icon green"><CheckCircle /></span>
          <div><span>Pedidos completados</span><strong>{loading ? "…" : pedidos.filter(p => p.estado === "COMPLETADO").length}</strong></div>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Agenda</span><h2>Mi próxima cita</h2></div>
          </div>
          {loading ? (
            <p className="help-text">Cargando...</p>
          ) : proxima ? (
            <div style={{ padding: "1rem 0" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: "700", marginBottom: "0.5rem" }}>
                {(() => {
                  const [y, m, d] = proxima.fecha_cita.slice(0, 10).split("-").map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });
                })()}
              </div>
              <p style={{ color: "var(--text-light)" }}>
                🕐 {proxima.hora_cita.slice(0, 5)} — Con {proxima.profesional_nombre}
              </p>
              <p style={{ color: "var(--text-light)" }}>📍 {proxima.consultorio || "Consultorio 1"}</p>
              <p style={{ marginTop: "0.5rem" }}>Motivo: <strong>{proxima.motivo || "Consulta preventiva"}</strong></p>
              <div style={{ display: "flex", gap: "10px", marginTop: "1rem", alignItems: "center" }}>
                <span className="status-badge info">{proxima.estado}</span>
                <button
                  className="secondary"
                  onClick={() => {
                    setReagendando(proxima);
                    setReagendarForm({ fecha_cita: proxima.fecha_cita.slice(0, 10), hora_cita: proxima.hora_cita.slice(0, 5) });
                  }}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
                >
                  Reagendar
                </button>
                <button
                  className="secondary"
                  onClick={() => handleCancelar(proxima.id_cita)}
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem", color: "var(--alert-color)" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "2rem 0", textAlign: "center" }}>
              <CalendarDays size={40} style={{ opacity: 0.2, marginBottom: "1rem" }} />
              <p className="help-text">No tienes citas próximas agendadas.</p>
              <button className="primary" onClick={() => setAgendando(true)} style={{ marginTop: "1rem" }}>
                Agendar mi cita ahora
              </button>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Tienda</span><h2>Mis pedidos web</h2></div>
          </div>

          <div style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
            background: "var(--card-bg)",
            padding: "0.5rem",
            borderRadius: "8px",
            border: "1px solid var(--border-color)"
          }}>
            <div style={{ flex: 1, minWidth: "150px", position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
              <input
                type="text"
                placeholder="Buscar por producto o SKU..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                style={{ paddingLeft: "2rem", width: "100%" }}
              />
            </div>
            <div style={{ minWidth: "150px" }}>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            {(filtroTexto || filtroFecha) && (
              <button
                className="secondary"
                onClick={() => { setFiltroTexto(""); setFiltroFecha(""); }}
                style={{ padding: "0.3rem 0.8rem" }}
              >
                Limpiar
              </button>
            )}
          </div>

          {loading ? (
            <p className="help-text">Cargando...</p>
          ) : pedidosFiltrados.length === 0 ? (
            <div style={{ padding: "2rem 0", textAlign: "center" }}>
              <ShoppingBag size={40} style={{ opacity: 0.2, marginBottom: "1rem" }} />
              <p className="help-text">
                {pedidos.length === 0
                  ? "Aún no has realizado pedidos."
                  : "No hay pedidos que coincidan con los filtros."}
              </p>
              {pedidos.length === 0 && (
                <button className="secondary" onClick={() => navigate("/dashboard/catalogo")} style={{ marginTop: "1rem" }}>
                  Ver productos
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="activity-list">
                {pedidosPaginados.map((p) => {
                  const productos = p.detalles?.map(d => d.nombre_producto || `Producto #${d.id_producto}`).join(", ") || "Sin productos";
                  const skus = p.detalles?.map(d => d.sku || d.codigo_barra || `ID:${d.id_producto}`).join(", ") || "";
                  return (
                    <div
                      key={p.id_pedido}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 0.5rem",
                        borderBottom: "1px solid var(--border-color)",
                        cursor: "pointer"
                      }}
                      onClick={() => setPedidoSeleccionado(p)}
                    >
                      <div>
                        <span style={{ fontWeight: "600" }}>Pedido #{p.id_pedido}</span>
                        <small style={{ display: "block", color: "var(--text-light)" }}>
                          {formatDate(p.fecha_solicitud, { dateStyle: "medium", timeStyle: undefined })} · {fmt(p.total)}
                        </small>
                        <small style={{ display: "block", color: "var(--text-light)", fontSize: "0.7rem" }}>
                          {productos} {skus && `(SKU: ${skus})`}
                        </small>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                        <span
                          style={{
                            padding: "0.2rem 0.8rem",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            background:
                              p.estado === "PENDIENTE"
                                ? "rgba(251,191,36,0.15)"
                                : p.estado === "COMPLETADO"
                                ? "rgba(34,197,94,0.15)"
                                : "rgba(239,68,68,0.15)",
                            color:
                              p.estado === "PENDIENTE"
                                ? "#b45309"
                                : p.estado === "COMPLETADO"
                                ? "#15803d"
                                : "#b91c1c",
                          }}
                        >
                          {p.estado}
                        </span>
                        {p.estado === "PENDIENTE" && (
                          <button
                            className="secondary"
                            onClick={(e) => { e.stopPropagation(); setComprobantePedido(p); }}
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
                            title="Ver comprobante"
                          >
                            <QrCode size={16} />
                          </button>
                        )}
                        {p.estado === "COMPLETADO" && (
                          <span style={{ color: "#28a745", fontSize: "0.7rem" }}>✓</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: "1rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid var(--border-color)"
                }}>
                  <button
                    className="secondary"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    style={{ padding: "0.3rem 0.8rem" }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    className="secondary"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    style={{ padding: "0.3rem 0.8rem" }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </article>
      </div>

      <article className="panel" style={{ marginTop: "2rem" }}>
        <div className="panel-heading">
          <div><span className="eyebrow">Historial</span><h2>Historial de mis citas</h2></div>
        </div>

        {/* Barra de filtros citas */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", padding: "0.75rem", background: "var(--card-bg)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <div style={{ flex: 1, minWidth: "150px", position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
            <input
              type="text"
              placeholder="Buscar por profesional o motivo..."
              value={filtroCitas}
              onChange={(e) => setFiltroCitas(e.target.value)}
              style={{ paddingLeft: "1.8rem", width: "100%" }}
            />
          </div>
          <select
            value={filtroCitaEstado}
            onChange={(e) => setFiltroCitaEstado(e.target.value)}
            style={{ minWidth: "130px" }}
          >
            <option value="">Todos los estados</option>
            {["Pendiente", "Confirmada", "Pagada", "Atendida", "Cancelada"].map(s => <option key={s}>{s}</option>)}
          </select>
          <input
            type="date"
            value={filtroCitaFecha}
            onChange={(e) => setFiltroCitaFecha(e.target.value)}
            style={{ minWidth: "140px" }}
          />
          {(filtroCitas || filtroCitaEstado || filtroCitaFecha) && (
            <button className="secondary" onClick={() => { setFiltroCitas(""); setFiltroCitaEstado(""); setFiltroCitaFecha(""); }} style={{ padding: "0.3rem 0.8rem" }}>Limpiar</button>
          )}
        </div>

        {(() => {
          const citasFiltradas = citas.filter(c => {
            const txt = filtroCitas.toLowerCase();
            const coincideTexto = !txt || c.profesional_nombre?.toLowerCase().includes(txt) || c.motivo?.toLowerCase().includes(txt);
            const coincideEstado = !filtroCitaEstado || c.estado === filtroCitaEstado;
            const coincideFecha = !filtroCitaFecha || c.fecha_cita.slice(0, 10) === filtroCitaFecha;
            return coincideTexto && coincideEstado && coincideFecha;
          });
          if (citas.length === 0) return <p className="help-text" style={{ padding: "1.5rem 0", textAlign: "center" }}>No tienes citas registradas.</p>;
          if (citasFiltradas.length === 0) return <p className="help-text" style={{ padding: "1rem 0", textAlign: "center" }}>No hay citas que coincidan con los filtros.</p>;
          return (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Profesional</th>
                    <th>Consultorio</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {citasFiltradas.map((c) => {
                    const [y, m, d] = c.fecha_cita.slice(0, 10).split("-").map(Number);
                    return (
                      <tr key={c.id_cita}>
                        <td>{new Date(y, m - 1, d).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td>{c.hora_cita.slice(0, 5)}</td>
                        <td>{c.profesional_nombre}</td>
                        <td>{c.consultorio || "Consultorio 1"}</td>
                        <td>{c.motivo || "—"}</td>
                        <td>
                          <span className={`status-badge ${c.estado === "Confirmada" || c.estado === "Atendida" ? "success" : c.estado === "Pendiente" ? "warning" : "danger"}`}>
                            {c.estado}
                          </span>
                        </td>
                        <td>
                          {["Pendiente", "Confirmada"].includes(c.estado) ? (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button className="secondary" style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                                onClick={() => { setReagendando(c); setReagendarForm({ fecha_cita: c.fecha_cita.slice(0, 10), hora_cita: c.hora_cita.slice(0, 5) }); }}>
                                Reagendar
                              </button>
                              <button className="secondary" style={{ padding: "3px 8px", fontSize: "0.75rem", color: "var(--alert-color)" }}
                                onClick={() => handleCancelar(c.id_cita)}>
                                Cancelar
                              </button>
                            </div>
                          ) : (<small style={{ color: "var(--text-light)" }}>—</small>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </article>

      {pedidoSeleccionado && (
        <div className="drawer-backdrop" onMouseDown={() => setPedidoSeleccionado(null)}>
          <aside className="drawer" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <div><span className="eyebrow">Detalle del pedido</span><h2>Pedido #{pedidoSeleccionado.id_pedido}</h2></div>
              <button className="icon-button secondary" onClick={() => setPedidoSeleccionado(null)} aria-label="Cerrar">✕</button>
            </header>
            <dl className="appointment-detail">
              <div><dt>Fecha solicitud</dt><dd>{formatDate(pedidoSeleccionado.fecha_solicitud)}</dd></div>
              <div><dt>Total</dt><dd>{fmt(pedidoSeleccionado.total)}</dd></div>
              <div><dt>Estado</dt><dd>{pedidoSeleccionado.estado}</dd></div>
              <div><dt>Productos</dt><dd>
                <ul style={{ padding: 0, listStyle: "none" }}>
                  {pedidoSeleccionado.detalles?.map((d, i) => (
                    <li key={i} style={{ marginBottom: "0.5rem" }}>
                      <strong>{d.nombre_producto || `Producto #${d.id_producto}`}</strong>
                      <br />
                      <small style={{ color: "var(--text-light)" }}>
                        Cantidad: {d.cantidad} · Precio unitario: {fmt(d.precio_unitario)}
                        {d.sku && ` · SKU: ${d.sku}`}
                        {d.codigo_barra && ` · Código: ${d.codigo_barra}`}
                      </small>
                    </li>
                  ))}
                </ul>
              </dd></div>
            </dl>
            <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
              <button onClick={() => { setComprobantePedido(pedidoSeleccionado); setPedidoSeleccionado(null); }}>
                <QrCode size={18} /> Ver comprobante
              </button>
              <button className="secondary" onClick={() => setPedidoSeleccionado(null)}>Cerrar</button>
            </div>
          </aside>
        </div>
      )}

      {comprobantePedido && (
        <ComprobantePedido
          pedido={comprobantePedido}
          onClose={() => setComprobantePedido(null)}
        />
      )}

      {/* Modal Agendar Cita */}
      {agendando && (
        <div className="drawer-backdrop" onMouseDown={() => setAgendando(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <div><span className="eyebrow">Nueva Atención</span><h2>Agendar mi cita</h2></div>
              <button className="icon-button secondary" onClick={() => setAgendando(false)} aria-label="Cerrar">✕</button>
            </header>
            <form onSubmit={handleAgendar} className="drawer-form">
              <label>
                Profesional (Optómetra) *
                <select required value={nuevaCita.id_usuario} onChange={(e) => setNuevaCita({ ...nuevaCita, id_usuario: e.target.value })}>
                  <option value="">Seleccione un profesional</option>
                  {profesionales.map((p) => (
                    <option key={p.id_usuario} value={p.id_usuario}>{p.nombre} {p.apellido}</option>
                  ))}
                </select>
              </label>

              <div className="field-grid">
                <label>
                  Fecha *
                  <input
                    required
                    type="date"
                    min={todayStr}
                    value={nuevaCita.fecha_cita}
                    onChange={(e) => setNuevaCita({ ...nuevaCita, fecha_cita: e.target.value, hora_cita: "" })}
                  />
                </label>
                <label>
                  Horario disponible *
                  <select
                    required
                    value={nuevaCita.hora_cita}
                    onChange={(e) => setNuevaCita({ ...nuevaCita, hora_cita: e.target.value })}
                    disabled={!nuevaCita.fecha_cita}
                  >
                    <option value="">{nuevaCita.fecha_cita ? "Seleccione horario" : "Primero elige la fecha"}</option>
                    {TIME_SLOTS.filter(slot => {
                      if (nuevaCita.fecha_cita !== todayStr) return true;
                      const [sh, sm] = slot.split(":").map(Number);
                      const now2 = new Date();
                      return sh > now2.getHours() || (sh === now2.getHours() && sm > now2.getMinutes());
                    }).map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Motivo de la consulta *
                <textarea
                  required
                  placeholder="Ej: Examen de la vista, molestia visual, control anual..."
                  value={nuevaCita.motivo}
                  onChange={(e) => setNuevaCita({ ...nuevaCita, motivo: e.target.value })}
                />
              </label>

              <div className="form-actions">
                <button className="primary" disabled={guardando}>
                  {guardando ? "Agendando…" : "Confirmar Cita"}
                </button>
                <button type="button" className="secondary" onClick={() => setAgendando(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* Modal Reagendar Cita */}
      {reagendando && (
        <div className="drawer-backdrop" onMouseDown={() => setReagendando(null)}>
          <aside className="drawer" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <div><span className="eyebrow">Reagendar Cita</span><h2>Cita #{reagendando.id_cita}</h2></div>
              <button className="icon-button secondary" onClick={() => setReagendando(null)} aria-label="Cerrar">✕</button>
            </header>
            <form onSubmit={handleReagendar} className="drawer-form">
              <p style={{ fontSize: "0.9rem", color: "var(--text-light)" }}>
                Profesional: <strong>{reagendando.profesional_nombre}</strong>
              </p>
              <div className="field-grid">
                <label>
                  Nueva Fecha *
                  <input
                    required
                    type="date"
                    min={todayStr}
                    value={reagendarForm.fecha_cita}
                    onChange={(e) => setReagendarForm({ ...reagendarForm, fecha_cita: e.target.value, hora_cita: "" })}
                  />
                </label>
                <label>
                  Nuevo Horario *
                  <select
                    required
                    value={reagendarForm.hora_cita}
                    onChange={(e) => setReagendarForm({ ...reagendarForm, hora_cita: e.target.value })}
                    disabled={!reagendarForm.fecha_cita}
                  >
                    <option value="">{reagendarForm.fecha_cita ? "Seleccione horario" : "Primero elige la fecha"}</option>
                    {TIME_SLOTS.filter(slot => {
                      if (reagendarForm.fecha_cita !== todayStr) return true;
                      const [sh, sm] = slot.split(":").map(Number);
                      const now2 = new Date();
                      return sh > now2.getHours() || (sh === now2.getHours() && sm > now2.getMinutes());
                    }).map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-actions">
                <button className="primary" disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar Nueva Fecha"}
                </button>
                <button type="button" className="secondary" onClick={() => setReagendando(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
};

// ------------------------------------------------------------
// DASHBOARD HOME
// ------------------------------------------------------------
export const DashboardHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user?.rol === "Paciente") return <PacienteDashboard />;

  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const content = ROLE_CONTENT[user?.rol] || RESTRICTED_CONTENT;
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    apiFetch("/dashboard")
      .then(setStats)
      .catch((error) => setMessage(error.message));
  }, []);

  const handleScanSuccess = (decodedText) => {
    setShowScanner(false);
    try {
      const url = new URL(decodedText);
      const pedidoId = url.searchParams.get("pedido");
      if (pedidoId) {
        navigate(`/dashboard/facturacion?pedido=${pedidoId}`);
      } else {
        const match = decodedText.match(/\d+/);
        if (match) {
          navigate(`/dashboard/facturacion?pedido=${match[0]}`);
        } else {
          alert("No se pudo identificar el pedido en el código QR.");
        }
      }
    } catch (e) {
      const match = decodedText.match(/\d+/);
      if (match) {
        navigate(`/dashboard/facturacion?pedido=${match[0]}`);
      } else {
        alert("Formato de QR no reconocido.");
      }
    }
  };

  // Reemplazar la acción de escaneo con un botón que abre el modal
  const actionsWithScan = content.actions.map(action => {
    if (action[1] === "#" && action[2] === Scan) {
      return [action[0], () => setShowScanner(true), action[2]];
    }
    return action;
  });

  return (
    <section className="module-page dashboard-page">
      <header className="hero-header">
        <div>
          <span className="eyebrow">
            {content.eyebrow} · {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <h1>Hola, {user?.nombre}</h1>
          <p>{content.description}</p>
        </div>
        <span className="role-badge">{user?.rol}</span>
      </header>

      {message && <div className="notice error" role="alert">{message}</div>}

      {!content.metrics.length && (
        <div className="notice warning" role="status">
          No se muestran datos operativos para el rol {user?.rol || "sin asignar"}.
        </div>
      )}

      <div className="metric-grid">
        {content.metrics.map(([label, key, Icon, tone]) => (
          <article className="metric-card" key={key}>
            <span className={`metric-icon ${tone}`}><Icon /></span>
            <div>
              <span>{label}</span>
              <strong>{formatMetric(key, stats?.[key])}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Acciones frecuentes</span>
              <h2>Continuar trabajando</h2>
            </div>
          </div>
          <div className="role-actions">
            {actionsWithScan.map(([label, to, Icon]) => {
              if (typeof to === "function") {
                // Botón de escaneo con estilo similar a los Links
                return (
                  <button
                    key={label}
                    onClick={to}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "2px 10px",
                      alignItems: "center",
                      minHeight: "74px",
                      padding: "14px",
                      border: "1px solid var(--line)",
                      borderRadius: "12px",
                      color: "var(--text)",
                      background: "#fbfdfd",
                      textDecoration: "none",
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer"
                    }}
                    className="role-action-button"
                  >
                    <Icon size={20} style={{ gridRow: "1/3", color: "var(--primary)" }} />
                    <span style={{ fontWeight: "800" }}>{label}</span>
                    <small style={{ color: "var(--muted)" }}>Escanear QR</small>
                  </button>
                );
              }
              return (
                <Link to={to} key={to}>
                  <Icon size={20} />
                  <span>{label}</span>
                  <small>Abrir módulo</small>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="panel quick-panel">
          <span className="eyebrow">Situación del día</span>
          <h2>Elementos que requieren atención</h2>
          <div className="quick-stat">
            <strong>{stats?.citas_pendientes ?? "—"}</strong>
            <span>Citas pendientes de confirmar</span>
          </div>
          <div className="quick-stat warning">
            <strong>{stats?.stock_bajo ?? "—"}</strong>
            <span>Productos en stock mínimo</span>
          </div>
        </article>
      </div>

      {showScanner && (
        <LectorQR
          onClose={() => setShowScanner(false)}
          onScanSuccess={handleScanSuccess}
        />
      )}
    </section>
  );
};

// ------------------------------------------------------------
// DASHBOARD PROFILE (sin cambios)
// ------------------------------------------------------------
export const DashboardProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ nombre: "", apellido: "", telefono: "", fecha_nacimiento: "" });
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const isPaciente = user?.rol === "Paciente";

  const initials = useMemo(
    () => `${profile?.nombre?.[0] || ""}${profile?.apellido?.[0] || ""}`.toUpperCase() || "U",
    [profile]
  );

  useEffect(() => {
    apiFetch("/auth/profile")
      .then((data) => {
        setProfile(data);
        setForm({
          nombre: data.nombre || "",
          apellido: data.apellido || "",
          telefono: data.telefono || "",
          fecha_nacimiento: String(data.fecha_nacimiento || "").slice(0, 10),
        });
      })
      .catch((error) => setNotice({ type: "error", text: error.message }));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await apiFetch("/auth/profile", { method: "PATCH", body: form });
      setProfile((current) => ({ ...current, ...updated }));
      setNotice({ type: "success", text: "Tus datos personales se actualizaron correctamente." });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (!profile)
    return (
      <section className="module-page">
        <div className="panel">{notice.text || "Cargando perfil…"}</div>
      </section>
    );

  return (
    <section className="module-page profile-page">
      <header className="profile-hero">
        <span className="profile-avatar" aria-hidden="true">{initials}</span>
        <div>
          <span className="eyebrow">Mi cuenta</span>
          <h1>{profile.nombre} {profile.apellido}</h1>
          <p>@{profile.usuario} · {profile.rol}</p>
        </div>
        <span className={`account-status ${profile.estado ? "active" : "inactive"}`}>
          {profile.estado ? "Cuenta activa" : "Cuenta inactiva"}
        </span>
      </header>

      {notice.text && <div className={`notice ${notice.type}`} role="status">{notice.text}</div>}

      <div className="profile-grid">
        <form className="panel" onSubmit={save}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Datos editables</span>
              <h2>Información personal</h2>
            </div>
          </div>
          <div className="field-grid">
            <label>
              Nombre *
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label>
              Apellido
              <input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
            </label>
            <label>
              Teléfono
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </label>
            <label>
              Fecha de nacimiento
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
              />
            </label>
          </div>
          <div className="locked-fields">
            <div>
              <span>Correo</span>
              <strong>{profile.correo}</strong>
              <small>Solo un administrador puede modificarlo.</small>
            </div>
            <div>
              <span>Usuario</span>
              <strong>{profile.usuario}</strong>
              <small>Identificador administrativo bloqueado.</small>
            </div>
            <div>
              <span>Rol</span>
              <strong>{profile.rol}</strong>
              <small>Definido por permisos del sistema.</small>
            </div>
          </div>
          <div className="form-actions">
            <button disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
          </div>
        </form>

        <aside className="profile-side">
          <article className="panel">
            <span className="eyebrow">Seguridad</span>
            <h2>Acceso a la cuenta</h2>
            <dl className="profile-facts">
              <div>
                <dt>Último acceso</dt>
                <dd>{formatDate(profile.ultimo_login)}</dd>
              </div>
              {!isPaciente && (
                <div>
                  <dt>Sesiones activas</dt>
                  <dd>{profile.sesiones_activas ?? 0}</dd>
                </div>
              )}
              <div>
                <dt>Contraseña</dt>
                <dd>Protegida con hash seguro</dd>
              </div>
            </dl>
            <p className="help-text">
              El cambio de contraseña se realiza mediante el flujo seguro de recuperación para revocar sesiones anteriores.
            </p>
          </article>

          {!isPaciente && (
            <article className="panel">
              <span className="eyebrow">Actividad permitida</span>
              <h2>Movimientos recientes</h2>
              <div className="activity-list">
                {profile.actividad_reciente?.length ? (
                  profile.actividad_reciente.map((item, index) => (
                    <div key={`${item.fecha}-${index}`}>
                      <span>{item.accion.replaceAll("_", " ")}</span>
                      <small>{formatDate(item.fecha)}</small>
                    </div>
                  ))
                ) : (
                  <p className="help-text">No hay actividad reciente disponible.</p>
                )}
              </div>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
};