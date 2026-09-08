import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/api";

const money = (n) =>
  Number(n || 0).toLocaleString("es-EC", { style: "currency", currency: "USD" });

const fecha = (v) => (v ? new Date(v).toLocaleDateString("es-EC") : "—");
const fechaHora = (v) => (v ? new Date(v).toLocaleString("es-EC") : "—");

// Definición de cada reporte: endpoint, filtros disponibles y columnas de la
// tabla. Añadir un reporte nuevo es solo agregar una entrada aquí.
const REPORTES = {
  citas: {
    titulo: "Citas",
    endpoint: "/reportes/citas",
    filtros: ["fecha_inicio", "fecha_fin", "medico", "estado", "paciente"],
    columnas: [
      { k: "fecha_cita", label: "Fecha", fmt: fecha },
      { k: "hora_cita", label: "Hora", fmt: (v) => (v ? String(v).slice(0, 5) : "—") },
      { k: "identificacion", label: "Cédula / ID" },
      { k: "paciente", label: "Paciente" },
      { k: "profesional", label: "Profesional" },
      { k: "motivo", label: "Motivo" },
      { k: "estado", label: "Estado" },
    ],
  },
  ventas: {
    titulo: "Ventas",
    endpoint: "/reportes/ventas",
    filtros: ["fecha_inicio", "fecha_fin", "tipo_pago"],
    columnas: [
      { k: "numero_factura", label: "Factura" },
      { k: "creado_en", label: "Fecha", fmt: fechaHora },
      { k: "paciente", label: "Paciente" },
      { k: "subtotal", label: "Subtotal", fmt: money },
      { k: "descuento", label: "Descuento", fmt: money },
      { k: "total", label: "Total", fmt: money },
      { k: "estado", label: "Estado" },
    ],
  },
  compras: {
    titulo: "Compras",
    endpoint: "/reportes/compras",
    filtros: ["fecha_inicio", "fecha_fin", "proveedor"],
    columnas: [
      { k: "id_orden_compra", label: "Orden #" },
      { k: "fecha_orden", label: "Fecha", fmt: fecha },
      { k: "proveedor", label: "Proveedor" },
      { k: "estado", label: "Estado" },
      { k: "total", label: "Total", fmt: money },
    ],
  },
  inventario: {
    titulo: "Inventario",
    endpoint: "/reportes/inventario",
    filtros: ["categoria", "stock_minimo"],
    columnas: [
      { k: "sku", label: "SKU" },
      { k: "nombre", label: "Producto" },
      { k: "categoria", label: "Categoría" },
      { k: "stock", label: "Stock" },
      { k: "stock_minimo", label: "Mínimo" },
      { k: "stock_bajo", label: "Alerta", fmt: (v) => (v ? "⚠️ Bajo" : "OK") },
      { k: "precio", label: "Precio", fmt: money },
    ],
  },
  "cierre-caja": {
    titulo: "Cierre de caja",
    endpoint: "/reportes/cierre-caja",
    filtros: ["fecha", "cajero"],
    columnas: [
      { k: "fecha", label: "Fecha", fmt: fecha },
      { k: "cajero", label: "Cajero" },
      { k: "monto_apertura", label: "Apertura", fmt: money },
      { k: "total_efectivo", label: "Efectivo", fmt: money },
      { k: "total_tarjeta", label: "Tarjeta", fmt: money },
      { k: "total_transferencia", label: "Transfer.", fmt: money },
      { k: "total_credito", label: "Crédito", fmt: money },
      { k: "monto_cierre", label: "Contado", fmt: money },
      { k: "retiro_banco", label: "Al banco", fmt: money },
      { k: "fondo_vueltos", label: "Vueltos", fmt: money },
      { k: "responsable", label: "Responsable" },
      { k: "diferencia", label: "Diferencia", fmt: money },
    ],
  },
};

const ETIQUETA_FILTRO = {
  fecha_inicio: "Desde",
  fecha_fin: "Hasta",
  fecha: "Fecha",
  medico: "ID médico",
  cajero: "ID cajero",
  proveedor: "ID proveedor",
  estado: "Estado",
  tipo_pago: "Forma de pago",
  categoria: "Categoría",
  stock_minimo: "Solo stock bajo",
  paciente: "Paciente o Cédula",
};

// Genera y descarga un CSV a partir de las filas y columnas visibles.
const exportarCSV = (nombre, columnas, filas) => {
  const cabecera = columnas.map((c) => c.label).join(",");
  const cuerpo = filas.map((fila) =>
    columnas
      .map((c) => {
        const valor = fila[c.k] ?? "";
        const texto = String(valor).replace(/"/g, '""');
        return /[",\n]/.test(texto) ? `"${texto}"` : texto;
      })
      .join(",")
  );
  const blob = new Blob([[cabecera, ...cuerpo].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte-${nombre}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default function Reportes() {
  const [tipo, setTipo] = useState("citas");
  const [filtros, setFiltros] = useState({});
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [opciones, setOpciones] = useState({ medicos: [], cajeros: [], proveedores: [], categorias: [] });

  useEffect(() => {
    apiFetch("/reportes/opciones-filtros")
      .then(setOpciones)
      .catch(() => {});
  }, []);

  const config = REPORTES[tipo];

  const consultar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const q = new URLSearchParams(
        Object.entries(filtros).filter(([, v]) => v !== "" && v != null)
      );
      setDatos(await apiFetch(`${config.endpoint}?${q}`));
    } catch (e) {
      setError(e.message);
      setDatos(null);
    } finally {
      setCargando(false);
    }
  }, [config.endpoint, filtros]);

  // Al cambiar de reporte, limpiar filtros y resultados.
  useEffect(() => {
    setFiltros({});
    setDatos(null);
    setError("");
  }, [tipo]);

  const filas = datos?.filas || [];

  // Resumen numérico según el reporte (total facturado, alertas, etc.).
  const resumen = useMemo(() => {
    if (!datos) return [];
    const r = [["Registros", datos.total ?? filas.length]];
    if (datos.total_facturado != null) r.push(["Total facturado", money(datos.total_facturado)]);
    if (datos.total_comprado != null) r.push(["Total comprado", money(datos.total_comprado)]);
    if (datos.en_alerta != null) r.push(["En alerta de stock", datos.en_alerta]);
    return r;
  }, [datos, filas.length]);

  return (
    <section className="module-page">
      <header className="page-header">
        <div>
          <h1>Reportes</h1>
          <p>Consultas de gestión con filtros y exportación a CSV.</p>
        </div>
        <button
          className="secondary"
          disabled={!filas.length}
          onClick={() => exportarCSV(tipo, config.columnas, filas)}
        >
          Exportar CSV
        </button>
      </header>

      <div className="filters" style={{ flexWrap: "wrap" }}>
        <label>
          Reporte
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(REPORTES).map(([k, v]) => (
              <option key={k} value={k}>{v.titulo}</option>
            ))}
          </select>
        </label>

        {config.filtros.map((f) =>
          f === "stock_minimo" ? (
            <label key={f}>
              {ETIQUETA_FILTRO[f]}
              <select
                value={filtros[f] || ""}
                onChange={(e) => setFiltros({ ...filtros, [f]: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="true">Solo stock bajo</option>
              </select>
            </label>
          ) : f === "tipo_pago" ? (
            <label key={f}>
              {ETIQUETA_FILTRO[f]}
              <select
                value={filtros[f] || ""}
                onChange={(e) => setFiltros({ ...filtros, [f]: e.target.value })}
              >
                <option value="">Todas</option>
                {["Efectivo", "Tarjeta", "Transferencia", "Credito"].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>
          ) : f === "medico" ? (
            <label key={f}>
              Médico / Optómetra
              <select
                value={filtros[f] || ""}
                onChange={(e) => setFiltros({ ...filtros, [f]: e.target.value })}
              >
                <option value="">Todos los médicos</option>
                {opciones.medicos.map((m) => (
                  <option key={m.id_usuario} value={m.id_usuario}>{m.nombre}</option>
                ))}
              </select>
            </label>
          ) : f === "cajero" ? (
            <label key={f}>
              Cajero
              <select
                value={filtros[f] || ""}
                onChange={(e) => setFiltros({ ...filtros, [f]: e.target.value })}
              >
                <option value="">Todos los cajeros</option>
                {opciones.cajeros.map((c) => (
                  <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
                ))}
              </select>
            </label>
          ) : f === "proveedor" ? (
            <label key={f}>
              Proveedor
              <select
                value={filtros[f] || ""}
                onChange={(e) => setFiltros({ ...filtros, [f]: e.target.value })}
              >
                <option value="">Todos los proveedores</option>
                {opciones.proveedores.map((p) => (
                  <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre}</option>
                ))}
              </select>
            </label>
          ) : f === "categoria" ? (
            <label key={f}>
              Categoría
              <select
                value={filtros[f] || ""}
                onChange={(e) => setFiltros({ ...filtros, [f]: e.target.value })}
              >
                <option value="">Todas las categorías</option>
                {opciones.categorias.map((cat) => (
                  <option key={cat.id_categoria} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
            </label>
          ) : f === "estado" ? (
            <label key={f}>
              Estado
              <select
                value={filtros[f] || ""}
                onChange={(e) => setFiltros({ ...filtros, [f]: e.target.value })}
              >
                <option value="">Todos los estados</option>
                {["Pendiente", "Confirmada", "En atención", "Atendida", "Cancelada", "No asistio"].map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </label>
          ) : (
            <label key={f}>
              {ETIQUETA_FILTRO[f] || f}
              <input
                type={f.startsWith("fecha") ? "date" : "text"}
                placeholder={f === "paciente" ? "Nombre o cédula..." : ""}
                value={filtros[f] || ""}
                onChange={(e) => setFiltros({ ...filtros, [f]: e.target.value })}
              />
            </label>
          )
        )}

        <div className="form-actions">
          <button onClick={consultar} disabled={cargando}>
            {cargando ? "Consultando…" : "Consultar"}
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      {datos && (
        <>
          <div className="summary-grid" style={{ margin: "1rem 0" }}>
            {resumen.map(([etiqueta, valor]) => (
              <article key={etiqueta}>
                <span>{etiqueta}</span>
                <strong>{valor}</strong>
              </article>
            ))}
          </div>

          {tipo === "ventas" && datos.por_forma_pago?.length > 0 && (
            <div className="summary-grid" style={{ marginBottom: "1rem" }}>
              {datos.por_forma_pago.map((p) => (
                <article key={p.forma_pago}>
                  <span>{p.forma_pago} ({p.facturas})</span>
                  <strong>{money(p.total)}</strong>
                </article>
              ))}
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>{config.columnas.map((c) => <th key={c.k}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => (
                  <tr key={fila.id_factura || fila.id_cita || fila.id_orden_compra || fila.id_producto || fila.id_caja_turno || i}>
                    {config.columnas.map((c) => (
                      <td key={c.k}>{c.fmt ? c.fmt(fila[c.k]) : (fila[c.k] ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filas.length && <p style={{ padding: "1rem", color: "#64748b" }}>Sin resultados para los filtros seleccionados.</p>}
          </div>
        </>
      )}
    </section>
  );
}
