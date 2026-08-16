import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const money = (n) =>
  Number(n || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
  });
export default function Caja() {
  const { user } = useAuth(),
    [caja, setCaja] = useState(null),
    [historial, setHistorial] = useState([]),
    [monto, setMonto] = useState(""),
    [observaciones, setObservaciones] = useState(""),
    [filtros, setFiltros] = useState({ desde: "", hasta: "", cajero: "" }),
    [mensaje, setMensaje] = useState(""),
    [resumenDia, setResumenDia] = useState(null);
  const cargar = useCallback(async () => {
    try {
      const q = new URLSearchParams(
        Object.entries(filtros).filter(([, v]) => v),
      );
      const [actual, rows, resumen] = await Promise.all([
        apiFetch("/caja"),
        apiFetch(`/caja/historial?${q}`),
        apiFetch("/facturacion/resumen-dia").catch(() => null)
      ]);
      setCaja(actual);
      setHistorial(rows);
      setResumenDia(resumen);
    } catch (e) {
      setMensaje(e.message);
    }
  }, [filtros]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  const operar = async (tipo) => {
    try {
      const data = await apiFetch(`/caja/${tipo}`, {
        method: "POST",
        body: {
          [tipo === "abrir" ? "monto_apertura" : "monto_cierre"]: monto,
          observaciones,
        },
      });
      setMensaje(
        tipo === "cerrar"
          ? `Caja cerrada. Diferencia: ${money(data.diferencia)}`
          : "Caja abierta",
      );
      setMonto("");
      setObservaciones("");
      cargar();
    } catch (e) {
      setMensaje(e.message);
    }
  };
  const imprimir = () => window.print();
  return (
    <section className="module-page">
      <header className="page-header">
        <div>
          <h1>Caja</h1>
          <p>{caja ? "Turno abierto" : "Sin turno abierto"}</p>
        </div>
        <button className="secondary" onClick={imprimir}>
          Imprimir historial
        </button>
      </header>
      {mensaje && <div className="notice">{mensaje}</div>}
      
      {resumenDia && (
        <>
          <h2>Resumen de Facturación (Hoy)</h2>
          <div className="summary-grid" style={{ marginBottom: "1rem" }}>
            <article>
              <span>Facturas emitidas</span>
              <strong>{resumenDia.facturasEmitidas}</strong>
            </article>
            <article>
              <span>Total facturado</span>
              <strong>{money(resumenDia.totalFacturas)}</strong>
            </article>
            <article>
              <span>Efectivo</span>
              <strong style={{ color: "var(--success-color)" }}>{money(resumenDia.totalEfectivo)}</strong>
            </article>
            <article>
              <span>Tarjeta</span>
              <strong>{money(resumenDia.totalTarjeta)}</strong>
            </article>
            <article>
              <span>Transferencia</span>
              <strong>{money(resumenDia.totalTransferencia)}</strong>
            </article>
            <article>
              <span>Crédito (Cuentas por cobrar)</span>
              <strong style={{ color: "var(--alert-color)" }}>{money(resumenDia.totalCredito)}</strong>
            </article>
          </div>
        </>
      )}

      <h2>Mi Caja Actual</h2>
      <div className="summary-grid">
        <article>
          <span>Monto de apertura</span>
          <strong>{money(caja?.monto_apertura)}</strong>
        </article>
        <article>
          <span>Estado</span>
          <strong>{caja?.estado ?? "Cerrada"}</strong>
        </article>
      </div>
      <div className="form-grid">
        <label>
          {caja ? "Efectivo declarado" : "Monto de apertura"}
          <input
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </label>
        {caja && (
          <label>
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Motivo de sobrante/faltante, si aplica"
            />
          </label>
        )}
        <div className="form-actions">
          <button
            disabled={monto === ""}
            onClick={() => operar(caja ? "cerrar" : "abrir")}
          >
            {caja ? "Cerrar y arquear" : "Abrir caja"}
          </button>
        </div>
      </div>
      <h2>Historial de cierres</h2>
      <div className="filters">
        <label>
          Desde
          <input
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
          />
        </label>
        {user?.rol === "Administrador" && (
          <label>
            ID cajero
            <input
              type="number"
              value={filtros.cajero}
              onChange={(e) =>
                setFiltros({ ...filtros, cajero: e.target.value })
              }
            />
          </label>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Apertura</th>
              <th>Cierre</th>
              <th>Cajero</th>
              <th>Inicial</th>
              <th>Ventas efectivo</th>
              <th>Declarado</th>
              <th>Diferencia</th>
              <th>Estado</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((x) => {
              const dif =
                x.diferencia != null
                  ? Number(x.diferencia)
                  : x.monto_cierre != null
                    ? Number(x.monto_cierre) -
                      (Number(x.monto_apertura) + Number(x.ventas_efectivo))
                    : null;
              return (
                <tr key={x.id_caja_turno}>
                  <td>{new Date(x.abierto_en).toLocaleString()}</td>
                  <td>
                    {x.cerrado_en
                      ? new Date(x.cerrado_en).toLocaleString()
                      : "—"}
                  </td>
                  <td>{x.cajero}</td>
                  <td>{money(x.monto_apertura)}</td>
                  <td>{money(x.ventas_efectivo)}</td>
                  <td>
                    {x.monto_cierre == null ? "—" : money(x.monto_cierre)}
                  </td>
                  <td
                    className={dif !== 0 && dif !== null ? "amount-alert" : ""}
                  >
                    {dif == null ? "—" : money(dif)}
                  </td>
                  <td>
                    {x.estado === "Cerrada"
                      ? dif === 0
                        ? "Cerrado correctamente"
                        : "Con diferencia"
                      : "Abierta"}
                  </td>
                  <td>{x.observaciones || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
