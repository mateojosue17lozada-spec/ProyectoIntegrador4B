import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

export default function Cartera() {
  const { user } = useAuth();
  const [cobrar, setCobrar] = useState([]),
    [pagar, setPagar] = useState([]),
    [seleccion, setSeleccion] = useState(null);
  const [abono, setAbono] = useState({ monto: "", forma_pago: "Efectivo" }),
    [msg, setMsg] = useState("");
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
  const exportar=()=>{const lines=[["Tipo","Tercero","Saldo","Vencimiento","Antigüedad"],...cobrar.map(x=>["Por cobrar",`${x.paciente_nombre} ${x.paciente_apellido}`,x.saldo,String(x.fecha_vencimiento).slice(0,10),x.antiguedad]),...pagar.map(x=>["Por pagar",x.proveedor,x.saldo,String(x.fecha_vencimiento).slice(0,10),x.antiguedad||x.estado])];const blob=new Blob([lines.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="antiguedad-cartera.csv";a.click();URL.revokeObjectURL(a.href)};
  const tabla = (titulo, rows, tipo) => (
    <>
      <h2>{titulo}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tercero</th>
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
                  {x.paciente_nombre
                    ? `${x.paciente_nombre} ${x.paciente_apellido}`
                    : x.proveedor}
                </td>
                <td>{x.saldo}</td>
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
    </section>
  );
}
