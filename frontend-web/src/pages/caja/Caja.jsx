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
    [retiroBanco, setRetiroBanco] = useState(""),
    [responsable, setResponsable] = useState(""),
    [arqueo, setArqueo] = useState(null),
    [filtros, setFiltros] = useState({ desde: "", hasta: "", cajero: "" }),
    [mensaje, setMensaje] = useState(""),
    [resumenDia, setResumenDia] = useState(null);
  const cargar = useCallback(async () => {
    try {
      const q = new URLSearchParams(
        Object.entries(filtros).filter(([, v]) => v),
      );
      const [actual, rows, resumen, arq] = await Promise.all([
        apiFetch("/caja"),
        apiFetch(`/caja/historial?${q}`),
        apiFetch("/facturacion/resumen-dia").catch(() => null),
        apiFetch("/caja/resumen").catch(() => null) // arqueo del turno abierto
      ]);
      setCaja(actual);
      setHistorial(rows);
      setResumenDia(resumen);
      setArqueo(arq);
    } catch (e) {
      setMensaje(e.message);
    }
  }, [filtros]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  // Efectivo que se queda en caja para vueltos = declarado - retiro al banco.
  const fondoVueltos =
    monto !== "" ? Math.max(0, Number(monto) - Number(retiroBanco || 0)) : 0;
  const operar = async (tipo) => {
    try {
      const body =
        tipo === "abrir"
          ? { monto_apertura: monto, observaciones }
          : {
              monto_cierre: monto,
              observaciones,
              retiro_banco: Number(retiroBanco || 0),
              responsable: responsable || null,
              efectivo_fondo: fondoVueltos,
            };
      const data = await apiFetch(`/caja/${tipo}`, { method: "POST", body });
      setMensaje(
        tipo === "cerrar"
          ? `Caja cerrada. Diferencia: ${money(data.diferencia)} · Se queda en caja: ${money(data.fondo_vueltos)} · Al banco: ${money(data.retiro_banco)}`
          : "Caja abierta",
      );
      setMonto("");
      setObservaciones("");
      setRetiroBanco("");
      setResponsable("");
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

      {/* Arqueo del turno: totales por tipo de pago (calculados por el backend
          filtrando por id_caja_turno, no por día) y efectivo esperado. */}
      {caja && arqueo && (
        <>
          <h3>Arqueo del turno (por tipo de pago)</h3>
          <div className="summary-grid" style={{ marginBottom: "1rem" }}>
            <article><span>Efectivo</span><strong style={{ color: "var(--success-color)" }}>{money(arqueo.total_efectivo)}</strong></article>
            <article><span>Tarjeta</span><strong>{money(arqueo.total_tarjeta)}</strong></article>
            <article><span>Transferencia</span><strong>{money(arqueo.total_transferencia)}</strong></article>
            <article><span>Crédito</span><strong style={{ color: "var(--alert-color)" }}>{money(arqueo.total_credito)}</strong></article>
            <article><span>Total del turno</span><strong>{money(arqueo.total_general)}</strong></article>
            <article><span>Efectivo esperado en caja</span><strong>{money(arqueo.efectivo_esperado)}</strong></article>
          </div>
        </>
      )}

      <div className="form-grid">
        <label>
          {caja ? "Efectivo contado (declarado)" : "Monto de apertura"}
          <input
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </label>
        {caja && (
          <>
            <label>
              Efectivo a retirar / depósito al banco
              <input
                type="number"
                min="0"
                step="0.01"
                value={retiroBanco}
                onChange={(e) => setRetiroBanco(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label>
              Efectivo que se queda en caja (vueltos)
              <input type="number" value={fondoVueltos.toFixed(2)} readOnly tabIndex={-1} />
            </label>
            <label>
              Responsable del retiro
              <input
                type="text"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Nombre de quien retira (opcional)"
              />
            </label>
            <label>
              Observaciones
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Motivo de sobrante/faltante, si aplica"
              />
            </label>
          </>
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
              <th>Al banco</th>
              <th>Responsable</th>
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
                  <td>{x.retiro_banco == null ? "—" : money(x.retiro_banco)}</td>
                  <td>{x.responsable || "—"}</td>
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
