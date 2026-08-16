import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

export default function Cartera() {
  const { user } = useAuth();
  const [cobrar, setCobrar] = useState([]),
    [pagar, setPagar] = useState([]),
    [seleccion, setSeleccion] = useState(null);
  const [abono, setAbono] = useState({ monto: "", forma_pago: "Efectivo" }),
    [msg, setMsg] = useState(""),
    [factDetalle, setFactDetalle] = useState(null);
  const load = useCallback(async () => {
    try {
      setCobrar(await apiFetch("/cartera/cobrar"));
      if (user?.rol === "Administrador")
        setPagar(await apiFetch("/cartera/pagar"));
    } catch (e) {
      setMsg(e.message);
    }
  }, [user]);
  useEffect(() => {
    load();
  }, [load]);

  const verFactura = async (row) => {
    try {
      const data = await apiFetch(`/facturacion/${row.id_factura}`);
      setFactDetalle({ 
        ...data, 
        cxc_saldo: row.saldo, 
        cxc_pagado: Number(row.total_factura || data.total) - Number(row.saldo) 
      });
    } catch(e) {
      setMsg("Error al cargar detalles de la factura: " + e.message);
    }
  };
  const guardar = async () => {
    try {
      await apiFetch(`/cartera/${seleccion.tipo}/${seleccion.id}/abonos`, {
        method: "POST",
        body: abono,
      });
      setSeleccion(null);
      setAbono({ monto: "", forma_pago: "Efectivo" });
      setMsg("Abono registrado");
      load();
    } catch (x) {
      setMsg(x.message);
    }
  };
  const resumen=(rows)=>["0-30","31-60","61-90","90+"].map(tramo=>({tramo,total:rows.filter(x=>x.antiguedad===tramo).reduce((s,x)=>s+Number(x.saldo||0),0)}));
  const exportar=()=>{const lines=[["Tipo","Factura","Tercero","Total","Saldo","Vencimiento","Antigüedad"],...cobrar.map(x=>["Por cobrar",x.numero_factura||'—',`${x.paciente_nombre} ${x.paciente_apellido}`,x.total_factura,x.saldo,String(x.fecha_vencimiento).slice(0,10),x.antiguedad]),...pagar.map(x=>["Por pagar","—",x.proveedor,"—",x.saldo,String(x.fecha_vencimiento).slice(0,10),x.antiguedad||x.estado])];const blob=new Blob([lines.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="antiguedad-cartera.csv";a.click();URL.revokeObjectURL(a.href)};
  const tabla = (titulo, rows, tipo) => (
    <>
      <h2>{titulo}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Tercero</th>
              <th>Total</th>
              <th>Saldo</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id_cxc || x.id_cxp}>
                <td>
                  {x.numero_factura || '—'}
                  {x.numero_factura && (
                    <button className="secondary" style={{ marginLeft: '0.5rem', padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => verFactura(x)}>
                      Ver
                    </button>
                  )}
                </td>
                <td>
                  {x.paciente_nombre
                    ? `${x.paciente_nombre} ${x.paciente_apellido}`
                    : x.proveedor}
                </td>
                <td>{x.total_factura ? `$${Number(x.total_factura).toFixed(2)}` : '—'}</td>
                <td>{`$${Number(x.saldo).toFixed(2)}`}</td>
                <td>{String(x.fecha_vencimiento).slice(0, 10)}</td>
                <td>{x.antiguedad || x.estado}</td>
                <td>
                  <button
                    onClick={() =>
                      setSeleccion({ tipo, id: x.id_cxc || x.id_cxp })
                    }
                  >
                    Abonar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
  return (
    <section className="module-page">
      <header className="page-header">
        <div>
          <h1>Cartera</h1>
          <p>Saldos y vencimientos</p>
        </div>
        <button className="secondary" onClick={exportar}>Exportar antigüedad</button>
      </header>
      {msg && <div className="notice">{msg}</div>}
      {seleccion && (
        <div className="form-grid">
          <label>
            Monto
            <input
              type="number"
              step="0.01"
              value={abono.monto}
              onChange={(e) => setAbono({ ...abono, monto: e.target.value })}
            />
          </label>
          {seleccion.tipo === "cobrar" && (
            <label>
              Forma de pago
              <select
                value={abono.forma_pago}
                onChange={(e) =>
                  setAbono({ ...abono, forma_pago: e.target.value })
                }
              >
                {["Efectivo", "Tarjeta", "Transferencia"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          )}
          <div className="form-actions">
            <button onClick={guardar}>Registrar abono</button>
            <button className="secondary" onClick={() => setSeleccion(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <h2>Reporte de antigüedad</h2><div className="summary-grid">{resumen(cobrar).map(x=><article key={x.tramo}><span>{x.tramo} días</span><strong>${x.total.toFixed(2)}</strong></article>)}</div>
      {tabla("Cuentas por cobrar", cobrar, "cobrar")}
      {user?.rol === "Administrador" &&
        tabla("Cuentas por pagar", pagar, "pagar")}

      {factDetalle && (() => {
        const pagado = factDetalle.cxc_pagado ?? 0;
        const saldo = factDetalle.cxc_saldo ?? 0;
        
        return (
          <div className="drawer-backdrop" onMouseDown={() => setFactDetalle(null)}>
            <aside 
              className="drawer" 
              role="dialog" 
              aria-modal="true" 
              onMouseDown={(e) => e.stopPropagation()} 
              style={{ maxWidth: '600px', width: '100%' }}
            >
              <header>
                <div>
                  <span className="eyebrow">Detalle de Factura</span>
                  <h2>Factura N° {factDetalle.numero_factura}</h2>
                </div>
                <button className="icon-button secondary" onClick={() => setFactDetalle(null)} aria-label="Cerrar">✕</button>
              </header>
              <div style={{ padding: '1rem 0' }}>
                <p style={{ margin: '0 0 0.5rem' }}><strong>Paciente:</strong> {factDetalle.paciente_nombre} {factDetalle.paciente_apellido}</p>
                <p style={{ margin: '0 0 0.5rem' }}><strong>Cédula:</strong> {factDetalle.cedula}</p>
                <p style={{ margin: '0 0 1rem' }}><strong>Fecha:</strong> {new Date(factDetalle.creado_en).toLocaleString()}</p>
                
                <div className="table-wrap" style={{ margin: '1rem 0' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Cant</th>
                        <th>Descripción</th>
                        <th>P. Unit</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factDetalle.detalles?.map(d => (
                        <tr key={d.id_detalle}>
                          <td>{d.cantidad}</td>
                          <td>{d.descripcion}</td>
                          <td>${Number(d.precio_unitario).toFixed(2)}</td>
                          <td>${(Number(d.cantidad) * Number(d.precio_unitario)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="summary-grid" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <article>
                    <span>Total Factura</span>
                    <strong>${Number(factDetalle.total).toFixed(2)}</strong>
                  </article>
                  <article>
                    <span>Abonado / Pagado</span>
                    <strong style={{ color: 'var(--success-color)' }}>${Number(pagado).toFixed(2)}</strong>
                  </article>
                  <article>
                    <span>Saldo Pendiente</span>
                    <strong style={{ color: saldo > 0 ? 'var(--alert-color)' : 'inherit' }}>${Number(saldo).toFixed(2)}</strong>
                  </article>
                </div>
              </div>
            </aside>
          </div>
        );
      })()}
    </section>
  );
}