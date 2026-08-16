import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const linea = () => ({ id_producto: "", descripcion: "", cantidad: 1, precio_unitario: "" });
const pago = () => ({ forma_pago: "Efectivo", monto: "", referencia: "" });

export default function Facturacion() {
  const { user } = useAuth();
  const location = useLocation(); 
  const [procesadoQR, setProcesadoQR] = useState(false);

  const [facturas, setFacturas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState({ id_paciente: "", id_receta: "", id_historia: "", id_promocion: "", descuento: 0, impuestos: 0, dias_credito: 30 });
  const [detalles, setDetalles] = useState([linea()]);
  const [pagos, setPagos] = useState([pago()]);
  const [accion, setAccion] = useState(null);
  const [accionForm, setAccionForm] = useState({ motivo: "", monto: "", reponer_stock: true });
  const [promo, setPromo] = useState({ nombre: "", porcentaje: "" });
  const [msg, setMsg] = useState("");
  const [printData, setPrintData] = useState(null);
  const [tab, setTab] = useState("facturas");

  // Filtros facturas
  const [filtroFacPaciente, setFiltroFacPaciente] = useState("");
  const [filtroFacFecha, setFiltroFacFecha] = useState("");
  const [filtroFacEstado, setFiltroFacEstado] = useState("");

  // Filtros pedidos
  const [filtroPedPaciente, setFiltroPedPaciente] = useState("");
  const [filtroPedFecha, setFiltroPedFecha] = useState("");

  const load = useCallback(async () => {
    try {
      const [f, p, pa, pr, ped] = await Promise.all([
        apiFetch("/facturacion"),
        apiFetch("/inventario"),
        apiFetch("/pacientes"),
        apiFetch("/facturacion/promociones"),
        apiFetch("/facturacion/pedidos")
      ]);
      setFacturas(f);
      setProductos(p);
      setPacientes(pa);
      setPromos(pr);
      setPedidos(ped);
    } catch (e) { setMsg(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 🔥 NUEVO: Manejar el parámetro ?pedido= de la URL
  useEffect(() => {
    if (procesadoQR) return; // Ya se procesó una vez
    const params = new URLSearchParams(location.search);
    const pedidoId = params.get("pedido");
    if (pedidoId && pedidos.length > 0) {
      const pedidoEncontrado = pedidos.find(p => String(p.id_pedido) === pedidoId);
      if (pedidoEncontrado && pedidoEncontrado.estado === "PENDIENTE") {
        // Abrir el modal de cobro
        setAccion({
          id: pedidoEncontrado.id_pedido,
          tipo: "cobrar_pedido",
          paciente: `${pedidoEncontrado.paciente_nombre} ${pedidoEncontrado.paciente_apellido}`,
          total: pedidoEncontrado.total,
          detalles: pedidoEncontrado.detalles
        });
        setPagos([{ forma_pago: "Efectivo", monto: "", referencia: "" }]);
        setProcesadoQR(true);
        // Cambiar automáticamente a la pestaña de pedidos web
        setTab("pedidos");
        // Limpiar el parámetro de la URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setMsg(`✅ Pedido #${pedidoId} cargado para cobrar.`);
      } else if (pedidoEncontrado) {
        setMsg(`ℹ️ El pedido #${pedidoId} no está pendiente (estado: ${pedidoEncontrado.estado}).`);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setMsg(`❌ Pedido #${pedidoId} no encontrado.`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [pedidos, location.search, procesadoQR]);

  // ... (resto del código igual, sin cambios en las funciones y el return)

  const subtotal = useMemo(() => detalles.reduce((s, d) => s + Number(d.cantidad || 0) * Number(d.precio_unitario || 0), 0), [detalles]);
  const selectedPromo = promos.find(p => String(p.id_promocion) === String(form.id_promocion));
  const total = subtotal - Number(form.descuento || 0) - (selectedPromo ? subtotal * Number(selectedPromo.porcentaje) / 100 : 0) + Number(form.impuestos || 0);
  const pagado = pagos.reduce((s, p) => s + Number(p.monto || 0), 0);
  const cambio = pagado > total ? pagado - total : 0;
  const saldo = total - pagado;

  const updateDetalle = (i, key, value) => setDetalles(detalles.map((d, n) => n === i ? { ...d, [key]: value } : d));
  const updatePago = (i, key, value) => setPagos(pagos.map((p, n) => n === i ? { ...p, [key]: value } : p));

  const emitir = async e => {
    e.preventDefault();
    try {
      let pendiente = total;
      const pagosAjustados = pagos.map(p => {
        if (p.forma_pago === "Efectivo" && Number(p.monto) > pendiente) { const a = { ...p, monto: pendiente }; pendiente = 0; return a; }
        pendiente -= Number(p.monto); return p;
      });
      await apiFetch("/facturacion", { method: "POST", body: { ...form, detalles, pagos: pagosAjustados } });
      setDetalles([linea()]); setPagos([pago()]);
      setForm({ id_paciente: "", id_receta: "", id_historia: "", id_promocion: "", descuento: 0, impuestos: 0, dias_credito: 30 });
      setMsg("✅ Factura emitida"); load();
    } catch (x) { setMsg(x.message); }
  };

  const ejecutar = async () => {
    try {
      await apiFetch(`/facturacion/${accion.id}/${accion.tipo}`, { method: "POST", body: accionForm });
      setAccion(null);
      const mensaje = accion.tipo === "anular" ? "Factura anulada" : "Devolución registrada";
      setMsg(`✅ ${mensaje}`);
      load();
    } catch (x) { setMsg(x.message); }
  };

  const confirmarPedido = async (e) => {
    e.preventDefault();
    try {
      let pendiente = Number(accion.total);
      const pagosAjustados = pagos.map(p => {
        if (p.forma_pago === "Efectivo" && Number(p.monto) > pendiente) { const a = { ...p, monto: pendiente }; pendiente = 0; return a; }
        pendiente -= Number(p.monto); return p;
      });
      const res = await apiFetch(`/facturacion/pedidos/${accion.id}/confirmar`, { method: "POST", body: { pagos: pagosAjustados } });
      setAccion(null);
      setMsg(`✅ Pedido cobrado – Factura ${res.numero_factura} generada`);
      setPagos([pago()]);
      load();
    } catch (x) { setMsg(x.message); }
  };

  const cancelarPedido = async (id) => {
    if (!window.confirm("¿Cancelar este pedido web?")) return;
    try {
      await apiFetch(`/facturacion/pedidos/${id}/cancelar`, { method: "POST" });
      setMsg("Pedido cancelado");
      load();
    } catch (x) { setMsg(x.message); }
  };

  const crearPromo = async e => {
    e.preventDefault();
    try { await apiFetch("/facturacion/promociones", { method: "POST", body: promo }); setPromo({ nombre: "", porcentaje: "" }); setMsg("Promocion creada"); load(); }
    catch (x) { setMsg(x.message); }
  };

  const imprimir = async id => {
    try { setPrintData(await apiFetch(`/facturacion/${id}`)); setTimeout(() => window.print(), 200); }
    catch (x) { setMsg(x.message); }
  };

  const fmt = v => `$${Number(v || 0).toFixed(2)}`;

  const estadoBadge = (estado) => {
    if (estado === "PENDIENTE") return <span className="badge-low-stock">Pendiente</span>;
    if (estado === "COMPLETADO") return <span style={{ color: "var(--success-color)" }}>Completado</span>;
    if (estado === "CANCELADO") return <span style={{ color: "var(--alert-color)" }}>Cancelado</span>;
    return estado;
  };

  return (
    <section className="module-page">
      {msg && <div className="notice" onClick={() => setMsg("")}>{msg}</div>}
      <header className="page-header">
        <div>
          <span className="eyebrow">Ventas y documentos</span>
          <h1>Facturación</h1>
          <p>Construye la venta por contexto, detalle y pagos; revisa el saldo antes de emitir.</p>
        </div>
      </header>

      {/* Formulario de factura directa */}
      <form className="billing-form" onSubmit={emitir}>
        <div className="form-grid">
          <label>Paciente<select value={form.id_paciente} onChange={e => setForm({ ...form, id_paciente: e.target.value })}><option value="">Consumidor final</option>{pacientes.map(p => <option key={p.id_paciente} value={p.id_paciente}>{p.nombre} {p.apellido}</option>)}</select></label>
          <label>ID receta<input type="number" value={form.id_receta} onChange={e => setForm({ ...form, id_receta: e.target.value })} /></label>
          <label>ID historia<input type="number" value={form.id_historia} onChange={e => setForm({ ...form, id_historia: e.target.value })} /></label>
          <label>Promoción<select value={form.id_promocion} onChange={e => setForm({ ...form, id_promocion: e.target.value })}><option value="">Sin promoción</option>{promos.filter(p => p.activo).map(p => <option key={p.id_promocion} value={p.id_promocion}>{p.nombre} · {p.porcentaje}%</option>)}</select></label>
          <label>Descuento autorizado<input type="number" step="0.01" value={form.descuento} onChange={e => setForm({ ...form, descuento: e.target.value })} /></label>
          <label>Impuestos<input type="number" step="0.01" value={form.impuestos} onChange={e => setForm({ ...form, impuestos: e.target.value })} /></label>
          <label>Días de crédito<input type="number" value={form.dias_credito} onChange={e => setForm({ ...form, dias_credito: e.target.value })} /></label>
        </div>
        <h2>Detalle</h2>
        {detalles.map((d, i) => <div className="form-grid" key={i}>
          <label>Escanear código<input placeholder="🔍 Código de barras..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const p = productos.find(x => x.codigo_barra === e.target.value || x.sku === e.target.value); if (p) { updateDetalle(i, "id_producto", String(p.id_producto)); setDetalles(prev => prev.map((x, n) => n === i ? { ...x, descripcion: p.nombre, precio_unitario: p.precio } : x)); e.target.value = ""; } else { alert("Producto no encontrado"); } } }} /></label>
          <label>Producto<select value={d.id_producto} onChange={e => { const p = productos.find(x => String(x.id_producto) === e.target.value); updateDetalle(i, "id_producto", e.target.value); setDetalles(prev => prev.map((x, n) => n === i ? { ...x, descripcion: p?.nombre || x.descripcion, precio_unitario: p?.precio || x.precio_unitario } : x)); }}><option value="">Servicio</option>{productos.map(p => <option key={p.id_producto} value={p.id_producto}>{p.nombre} ({p.stock})</option>)}</select></label>
          <label>Descripcion<input required value={d.descripcion} onChange={e => updateDetalle(i, "descripcion", e.target.value)} /></label>
          <label>Cantidad<input required type="number" min="1" value={d.cantidad} onChange={e => updateDetalle(i, "cantidad", e.target.value)} /></label>
          <label>Precio<input required type="number" step="0.01" value={d.precio_unitario} onChange={e => updateDetalle(i, "precio_unitario", e.target.value)} /></label>
          <div className="form-actions">{detalles.length > 1 && <button type="button" className="secondary" onClick={() => setDetalles(detalles.filter((_, n) => n !== i))}>Quitar</button>}</div>
        </div>)}
        <button type="button" className="secondary" onClick={() => setDetalles([...detalles, linea()])}>Agregar linea</button>
        <h2>Pagos</h2>
        {pagos.map((p, i) => <div className="form-grid" key={i}>
          <label>Forma<select value={p.forma_pago} onChange={e => updatePago(i, "forma_pago", e.target.value)}>{["Efectivo", "Tarjeta", "Transferencia", "Credito", "Mixto"].map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Monto<input required type="number" min="0" step="0.01" value={p.monto} onChange={e => updatePago(i, "monto", e.target.value)} /></label>
          <label>Referencia<input value={p.referencia} onChange={e => updatePago(i, "referencia", e.target.value)} /></label>
          <div className="form-actions">{pagos.length > 1 && <button type="button" className="secondary" onClick={() => setPagos(pagos.filter((_, n) => n !== i))}>Quitar</button>}</div>
        </div>)}
        <button type="button" className="secondary" onClick={() => setPagos([...pagos, pago()])}>Agregar pago</button>
        <div className="summary-grid billing-summary">
          <article><span>Subtotal</span><strong>{fmt(subtotal)}</strong></article>
          <article><span>Total</span><strong>{fmt(total)}</strong></article>
          <article><span>Pagado</span><strong>{fmt(pagado)}</strong></article>
          {cambio > 0
            ? <article className="amount-alert"><span>Cambio</span><strong>{fmt(cambio)}</strong></article>
            : <article><span>Saldo</span><strong>{fmt(Math.max(0, saldo))}</strong></article>
          }
        </div>
        <button type="submit" disabled={total <= 0 || (pagado < total && !form.id_paciente)}>Emitir factura</button>
      </form>

      {/* Promociones (solo Admin) */}
      {user?.rol === "Administrador" && <>
        <h2>Promociones</h2>
        <form className="form-grid" onSubmit={crearPromo}>
          <label>Nombre<input required value={promo.nombre} onChange={e => setPromo({ ...promo, nombre: e.target.value })} /></label>
          <label>Porcentaje<input required type="number" min="0" max="100" value={promo.porcentaje} onChange={e => setPromo({ ...promo, porcentaje: e.target.value })} /></label>
          <div className="form-actions"><button>Crear promocion</button></div>
        </form>
        <p>{promos.filter(p => p.activo).map(p => `${p.nombre} (${p.porcentaje}%)`).join(" · ")}</p>
      </>}

      {/* Modal de acción (Anular / Devolver) */}
      {accion && accion.tipo !== "cobrar_pedido" && <div className="form-grid">
        <label>Motivo<textarea required value={accionForm.motivo} onChange={e => setAccionForm({ ...accionForm, motivo: e.target.value })} /></label>
        {accion.tipo === "devoluciones" && (
          <>
            <label>
              Monto
              <input 
                type="number" 
                step="0.01" 
                value={accionForm.monto} 
                onChange={e => setAccionForm({ ...accionForm, monto: e.target.value })} 
              />
              <small style={{ display: 'block', color: 'var(--text-light)' }}>Monto total de la factura: {fmt(accion.total)}</small>
            </label>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={accionForm.reponer_stock} 
                onChange={e => setAccionForm({ ...accionForm, reponer_stock: e.target.checked })} 
              />
              Reponer productos al inventario
            </label>
          </>
        )}
        <div className="form-actions">
          <button onClick={ejecutar}>Confirmar</button>
          <button className="secondary" onClick={() => { setAccion(null); setAccionForm({ motivo: "", monto: "", reponer_stock: true }); }}>Cancelar</button>
        </div>
      </div>}

      {/* Modal de cobro de pedido web */}
      {accion && accion.tipo === "cobrar_pedido" && (
        <form className="billing-form" onSubmit={confirmarPedido}>
          <div style={{ padding: "1.5rem", border: "2px solid var(--primary-color)", borderRadius: "8px", marginBottom: "2rem" }}>
            <h3>Cobrar Pedido #{accion.id} – Paciente: {accion.paciente}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <strong>Total a cobrar:</strong>
                <span style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--primary-color)" }}>{fmt(accion.total)}</span>
                <small style={{ display: "block", color: "var(--text-light)" }}>Este monto es fijo</small>
              </div>
              <div>
                <strong>Productos:</strong>
                <ul style={{ padding: 0, listStyle: "none" }}>
                  {accion.detalles?.map((d, i) => (
                    <li key={i} style={{ fontSize: "0.85rem" }}>
                      {d.nombre_producto} x{d.cantidad} 
                      {d.sku && <small style={{ color: "var(--text-light)" }}> (SKU: {d.sku})</small>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <h4>Registrar pagos</h4>
            {pagos.map((p, i) => <div className="form-grid" key={i}>
              <label>Forma<select value={p.forma_pago} onChange={e => updatePago(i, "forma_pago", e.target.value)}>{["Efectivo", "Tarjeta", "Transferencia", "Credito", "Mixto"].map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Monto<input required type="number" min="0" step="0.01" value={p.monto} onChange={e => updatePago(i, "monto", e.target.value)} /></label>
              <label>Referencia<input value={p.referencia} onChange={e => updatePago(i, "referencia", e.target.value)} /></label>
              <div className="form-actions">{pagos.length > 1 && <button type="button" className="secondary" onClick={() => setPagos(pagos.filter((_, n) => n !== i))}>Quitar</button>}</div>
            </div>)}
            <button type="button" className="secondary" onClick={() => setPagos([...pagos, pago()])}>Agregar pago</button>

            {/* Resumen de pagos */}
            <div className="summary-grid billing-summary" style={{ marginTop: "1rem" }}>
              <article><span>Total pedido</span><strong>{fmt(accion.total)}</strong></article>
              <article><span>Pagado</span><strong>{fmt(pagado)}</strong></article>
              {pagado > accion.total && <article className="amount-alert"><span>Cambio</span><strong>{fmt(pagado - accion.total)}</strong></article>}
              {pagado < accion.total && <article><span>Saldo</span><strong>{fmt(accion.total - pagado)}</strong></article>}
            </div>

            <div className="form-actions" style={{ marginTop: "1rem" }}>
              <button type="submit" disabled={pagado <= 0}>Confirmar Cobro y Emitir Factura</button>
              <button type="button" className="secondary" onClick={() => { setAccion(null); setPagos([pago()]); }}>Cancelar</button>
            </div>
          </div>
        </form>
      )}

      {/* Tabs: Facturas / Pedidos web */}
      <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", borderBottom: "2px solid var(--border-color)", paddingBottom: "0.5rem" }}>
        <button type="button" className={tab === "facturas" ? "" : "secondary"} onClick={() => setTab("facturas")}>
          Facturas emitidas
        </button>
        <button type="button" className={tab === "pedidos" ? "" : "secondary"} onClick={() => setTab("pedidos")} style={{ position: "relative" }}>
          Pedidos web
          {pedidos.filter(p => p.estado === "PENDIENTE").length > 0 && (
            <span style={{ position: "absolute", top: "-6px", right: "-6px", background: "var(--primary-color)", color: "white", borderRadius: "50%", width: "18px", height: "18px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pedidos.filter(p => p.estado === "PENDIENTE").length}
            </span>
          )}
        </button>
      </div>

      {/* Tabla de facturas emitidas */}
      {tab === "facturas" && (
        <>
          {/* Filtros facturas */}
          <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0", flexWrap: "wrap", padding: "0.75rem", background: "var(--card-bg)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <input
              type="text"
              placeholder="🔍 Buscar por paciente o N° factura..."
              value={filtroFacPaciente}
              onChange={e => setFiltroFacPaciente(e.target.value)}
              style={{ flex: 1, minWidth: "180px" }}
            />
            <select value={filtroFacEstado} onChange={e => setFiltroFacEstado(e.target.value)} style={{ minWidth: "130px" }}>
              <option value="">Todos los estados</option>
              {["Emitida", "Anulada", "Devuelta"].map(s => <option key={s}>{s}</option>)}
            </select>
            <input
              type="date"
              value={filtroFacFecha}
              onChange={e => setFiltroFacFecha(e.target.value)}
              style={{ minWidth: "140px" }}
            />
            {(filtroFacPaciente || filtroFacEstado || filtroFacFecha) && (
              <button className="secondary" onClick={() => { setFiltroFacPaciente(""); setFiltroFacEstado(""); setFiltroFacFecha(""); }} style={{ padding: "0.3rem 0.8rem" }}>Limpiar</button>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N° Factura</th>
                  <th>Paciente</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas
                  .filter(f => {
                    const txt = filtroFacPaciente.toLowerCase();
                    const coincideTexto = !txt ||
                      `${f.paciente_nombre} ${f.paciente_apellido}`.toLowerCase().includes(txt) ||
                      String(f.numero_factura).toLowerCase().includes(txt);
                    const coincideEstado = !filtroFacEstado || f.estado === filtroFacEstado;
                    const coincideFecha = !filtroFacFecha || new Date(f.creado_en).toISOString().slice(0, 10) === filtroFacFecha;
                    return coincideTexto && coincideEstado && coincideFecha;
                  })
                  .map(f => (
                    <tr key={f.id_factura}>
                      <td>{f.numero_factura}</td>
                      <td>{f.paciente_nombre} {f.paciente_apellido}</td>
                      <td>{fmt(f.total)}</td>
                      <td>{fmt(f.pagado || 0)}</td>
                      <td>{fmt(f.saldo || 0)}</td>
                      <td>{f.estado}</td>
                      <td>{new Date(f.creado_en).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short", timeZone: "America/Guayaquil" })}</td>
                      <td>
                        <button className="secondary" onClick={() => imprimir(f.id_factura)}>Imprimir</button>
                        {user?.rol === "Administrador" && f.estado === "Emitida" && (
                          <>
                            <button className="secondary" onClick={() => setAccion({ id: f.id_factura, tipo: "anular" })}>Anular</button>
                            <button className="secondary" onClick={() => {
                              setAccion({ id: f.id_factura, tipo: "devoluciones", total: f.total, pagado: f.pagado || 0 });
                              setAccionForm({ motivo: "", monto: f.pagado || 0, reponer_stock: true });
                            }}>Devolver</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                {facturas.filter(f => {
                  const txt = filtroFacPaciente.toLowerCase();
                  return (!txt || `${f.paciente_nombre} ${f.paciente_apellido}`.toLowerCase().includes(txt) || String(f.numero_factura).toLowerCase().includes(txt))
                    && (!filtroFacEstado || f.estado === filtroFacEstado)
                    && (!filtroFacFecha || new Date(f.creado_en).toISOString().slice(0, 10) === filtroFacFecha);
                }).length === 0 && (
                  <tr><td colSpan="8" style={{ textAlign: "center", color: "var(--text-light)", padding: "1.5rem" }}>
                    {facturas.length === 0 ? "No hay facturas emitidas." : "No hay facturas que coincidan con los filtros."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* Tabla de pedidos web */}
      {tab === "pedidos" && (
        <>
          {/* Filtros pedidos */}
          <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0", flexWrap: "wrap", padding: "0.75rem", background: "var(--card-bg)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <input
              type="text"
              placeholder="🔍 Buscar por paciente o # pedido..."
              value={filtroPedPaciente}
              onChange={e => setFiltroPedPaciente(e.target.value)}
              style={{ flex: 1, minWidth: "180px" }}
            />
            <input
              type="date"
              value={filtroPedFecha}
              onChange={e => setFiltroPedFecha(e.target.value)}
              style={{ minWidth: "140px" }}
            />
            {(filtroPedPaciente || filtroPedFecha) && (
              <button className="secondary" onClick={() => { setFiltroPedPaciente(""); setFiltroPedFecha(""); }} style={{ padding: "0.3rem 0.8rem" }}>Limpiar</button>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Paciente</th><th>Productos</th><th>Total</th><th>Estado</th><th>Fecha solicitud</th><th>Acciones</th></tr></thead>
              <tbody>
                {pedidos
                  .filter(p => {
                    const txt = filtroPedPaciente.toLowerCase();
                    const coincideTexto = !txt ||
                      `${p.paciente_nombre} ${p.paciente_apellido}`.toLowerCase().includes(txt) ||
                      String(p.id_pedido).includes(txt);
                    const coincideFecha = !filtroPedFecha || new Date(p.fecha_solicitud).toISOString().slice(0, 10) === filtroPedFecha;
                    return coincideTexto && coincideFecha;
                  })
                  .map(p => {
                    const prods = p.detalles?.map(d => `${d.nombre_producto} x${d.cantidad}`).join(", ") || "—";
                    return (
                      <tr key={p.id_pedido}>
                        <td>#{p.id_pedido}</td>
                        <td>
                          {p.paciente_nombre} {p.paciente_apellido}
                          {p.paciente_telefono && <><br /><small style={{ color: "var(--text-light)" }}>{p.paciente_telefono}</small></>}
                        </td>
                        <td><small style={{ color: "var(--text-light)" }}>{prods}</small></td>
                        <td>{fmt(p.total)}</td>
                        <td>{estadoBadge(p.estado)}</td>
                        <td>{new Date(p.fecha_solicitud).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short", timeZone: "America/Guayaquil" })}</td>
                        <td>
                          {p.estado === "PENDIENTE" && (
                            <>
                              <button onClick={() => {
                                setAccion({ id: p.id_pedido, tipo: "cobrar_pedido", paciente: `${p.paciente_nombre} ${p.paciente_apellido}`, total: p.total, detalles: p.detalles });
                                setPagos([{ forma_pago: "Efectivo", monto: "", referencia: "" }]);
                              }}>Cobrar</button>
                              <button className="secondary" onClick={() => cancelarPedido(p.id_pedido)}>Cancelar</button>
                            </>
                          )}
                          {p.estado === "COMPLETADO" && <span style={{ color: "var(--success-color)" }}>✓ Completado</span>}
                          {p.estado === "CANCELADO" && <span style={{ color: "var(--alert-color)" }}>✗ Cancelado</span>}
                        </td>
                      </tr>
                    );
                  })}
                {pedidos.filter(p => {
                  const txt = filtroPedPaciente.toLowerCase();
                  return (!txt || `${p.paciente_nombre} ${p.paciente_apellido}`.toLowerCase().includes(txt) || String(p.id_pedido).includes(txt))
                    && (!filtroPedFecha || new Date(p.fecha_solicitud).toISOString().slice(0, 10) === filtroPedFecha);
                }).length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: "center", color: "var(--text-light)", padding: "1.5rem" }}>
                    {pedidos.length === 0 ? "No hay pedidos web registrados." : "No hay pedidos que coincidan con los filtros."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Ticket de impresión */}
      {printData && <article className="print-document">
        <header><div><h1>Óptica Integral</h1><p>Factura</p></div><strong>{printData.numero_factura}</strong></header>
        <p><b>Paciente:</b> {printData.paciente_nombre} {printData.paciente_apellido} · {printData.cedula}</p>
        <p><b>Fecha:</b> {new Date(printData.creado_en).toLocaleString()}</p>
        <table>
          <thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr></thead>
          <tbody>{printData.detalles?.map(d => <tr key={d.id_detalle}><td>{d.descripcion}</td><td>{d.cantidad}</td><td>{fmt(d.precio_unitario)}</td><td>{fmt(d.total)}</td></tr>)}</tbody>
        </table>
        <div className="summary-grid">
          <article><span>Subtotal</span><strong>{fmt(printData.subtotal)}</strong></article>
          <article><span>Descuento</span><strong>{fmt(printData.descuento)}</strong></article>
          <article><span>Impuestos</span><strong>{fmt(printData.impuestos)}</strong></article>
          <article><span>Total</span><strong>{fmt(printData.total)}</strong></article>
        </div>
      </article>}
    </section>
  );
}