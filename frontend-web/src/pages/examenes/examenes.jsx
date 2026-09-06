import { useCallback, useEffect, useState } from "react";
import { Activity, Plus } from "lucide-react";
import { apiFetch } from "../../services/api";
import { compatibles, esRedondeada, colorMontura, esArmazon } from "../../components/tryon/frameShapes";
const eye = { hallazgo: "Normal", color: "#22c55e", severidad: 0 };
const empty = {
  id_paciente: "",
  id_cita: "",
  ojo_derecho: "",
  ojo_izquierdo: "",
  diagnostico: "",
  observacion: "",
  esquema_ocular: { od: { ...eye }, oi: { ...eye } },
};
const hallazgos = {
  Normal: "#22c55e",
  Enrojecimiento: "#ef4444",
  Catarata: "#94a3b8",
  Pterigion: "#f59e0b",
  Lesion: "#8b5cf6",
  Inflamacion: "#f97316",
  Otro: "#0ea5e9",
};
function EyeDiagram({ side, value, onChange }) {
  const v = value || eye,
    opacity = 0.18 + Number(v.severidad || 0) * 0.2;
  return (
    <div className="eye-editor">
      <strong>
        {side === "od" ? "Ojo derecho (OD)" : "Ojo izquierdo (OI)"}
      </strong>
      <svg viewBox="0 0 240 125" role="img" aria-label={`Esquema ${side}`}>
        <defs>
          <radialGradient id={`sclera-${side}`}><stop offset="0" stopColor="#fff"/><stop offset=".72" stopColor="#f8fbfc"/><stop offset="1" stopColor="#dbe7ec"/></radialGradient>
          <radialGradient id={`iris-${side}`}><stop offset="0" stopColor={v.color}/><stop offset=".62" stopColor={v.color}/><stop offset="1" stopColor="#243746"/></radialGradient>
          <filter id={`shadow-${side}`}><feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity=".28"/></filter>
        </defs>
        <path
          d="M12 63 Q60 8 120 12 Q180 8 228 63 Q180 117 120 113 Q60 117 12 63Z"
          fill={`url(#sclera-${side})`}
          stroke="#31566a"
          strokeWidth="5"
          filter={`url(#shadow-${side})`}
        />
        <g stroke="#ef9a9a" strokeWidth="1" opacity={v.hallazgo === "Enrojecimiento" ? ".75" : ".22"} fill="none"><path d="M24 58 Q61 49 80 58"/><path d="M29 73 Q62 68 82 64"/><path d="M216 57 Q181 49 160 58"/><path d="M211 75 Q180 68 158 65"/></g>
        <circle cx="120" cy="63" r="39" fill={v.color} opacity={opacity} />
        <circle cx="120" cy="63" r="25" fill={`url(#iris-${side})`} stroke="#1e293b" strokeWidth="1.5" />
        {[0,30,60,90,120,150].map(a=><line key={a} x1="120" y1="42" x2="120" y2="48" stroke="#fff" opacity=".35" transform={`rotate(${a} 120 63)`}/>)}
        <circle cx="120" cy="63" r="9" fill="#111827" />
        <circle cx="111" cy="53" r="5" fill="#fff" opacity=".85" />
      </svg>
      <label>
        Hallazgo
        <select
          value={v.hallazgo}
          onChange={(e) =>
            onChange({
              ...v,
              hallazgo: e.target.value,
              color: hallazgos[e.target.value],
            })
          }
        >
          {Object.keys(hallazgos).map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </label>
      <label>
        Severidad: {v.severidad}/4
        <input
          type="range"
          min="0"
          max="4"
          value={v.severidad}
          onChange={(e) =>
            onChange({ ...v, severidad: Number(e.target.value) })
          }
        />
      </label>
    </div>
  );
}
function GeneratedFrame({ product, size, top, rotation }) {
  return (
    <div
      className={`generated-frame ${esRedondeada(product) ? "round" : "angular"}`}
      style={{
        width: `${size}%`,
        top: `${top}%`,
        transform: `translate(-50%,-50%) rotate(${rotation}deg)`,
        color: colorMontura(product),
      }}
      aria-label={`Vista provisional de ${product.nombre}`}
    >
      <span />
      <i />
      <span />
    </div>
  );
}
function VirtualTryOn({ patient, products }) {
  const frameProducts=products.filter(p=>p.imagen_data||esArmazon(p)),
    available = frameProducts.length?frameProducts:products,
    recommended = available.filter(
      (p) =>
        !patient?.forma_rostro ||
        compatibles[patient.forma_rostro]?.includes(p.forma_montura),
    ),
    [id, setId] = useState(""),
    [size, setSize] = useState(62),
    [top, setTop] = useState(39),
    [rotation, setRotation] = useState(0),
    selected =
      available.find((p) => String(p.id_producto) === id) || recommended[0];
  if (!patient?.foto_data)
    return (
      <div className="notice">
        Agregue una foto frontal al paciente para usar el probador virtual.
      </div>
    );
  return (
    <div className="tryon-panel">
      <div className="tryon-canvas">
        <img src={patient.foto_data} alt={`Foto de ${patient.nombre}`} />
        {selected?.imagen_data && (
          <img
            className="frame-overlay"
            src={selected.imagen_data}
            alt={selected.nombre}
            style={{
              width: `${size}%`,
              top: `${top}%`,
              transform: `translate(-50%,-50%) rotate(${rotation}deg)`,
            }}
          />
        )}
        {selected&&!selected.imagen_data&&<GeneratedFrame product={selected} size={size} top={top} rotation={rotation}/>}
      </div>
      <div className="tryon-controls">
        <p>
          <b>Rostro:</b> {patient.forma_rostro || "sin clasificar"}.
          Recomendación estética, no clínica.
        </p>
        <label>
          Montura
          <select
            value={selected?.id_producto || ""}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">Seleccione</option>
            {available.map((p) => (
              <option key={p.id_producto} value={p.id_producto}>
                {recommended.includes(p) ? "★ " : ""}
                {p.nombre} · {p.forma_montura || "sin forma"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ancho
          <input
            type="range"
            min="35"
            max="90"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        </label>
        <label>
          Altura
          <input
            type="range"
            min="20"
            max="65"
            value={top}
            onChange={(e) => setTop(e.target.value)}
          />
        </label>
        <label>
          Rotación
          <input
            type="range"
            min="-15"
            max="15"
            value={rotation}
            onChange={(e) => setRotation(e.target.value)}
          />
        </label>
        {selected && (
          <strong>
            {selected.nombre} ·{" "}
            {selected.color_montura || "color sin registrar"}
          </strong>
        )}
      </div>
    </div>
  );
}
export default function Examenes() {
  const [rows, setRows] = useState([]),
    [patients, setPatients] = useState([]),
    [products, setProducts] = useState([]),
    [appointments, setAppointments] = useState([]),
    [form, setForm] = useState(empty),
    [edit, setEdit] = useState(null),
    [open, setOpen] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const [e, p, c, pr] = await Promise.all([
        apiFetch("/examenes"),
        apiFetch("/pacientes"),
        apiFetch("/citas"),
        apiFetch("/inventario"),
      ]);
      setRows(e);
      setPatients(p);
      setProducts(pr);
      setAppointments(
        c.filter(
          (x) =>
            x.pago_previo && !["Cancelada", "No asistio"].includes(x.estado),
        ),
      );
    } catch (error) {
      setMessage(error.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const save = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(edit ? `/examenes/${edit}` : "/examenes", {
        method: edit ? "PUT" : "POST",
        body: form,
      });
      setForm(empty);
      setEdit(null);
      setOpen(false);
      setMessage("Examen guardado");
      load();
    } catch (error) {
      setMessage(error.message);
    }
  };
  const startEdit = (row) => {
    setForm({
      ...empty,
      ...row,
      esquema_ocular: {
        od: { ...eye, ...row.esquema_ocular?.od },
        oi: { ...eye, ...row.esquema_ocular?.oi },
      },
    });
    setEdit(row.id_examen);
    setOpen(true);
  };
  const setEye = (side, value) =>
      setForm({
        ...form,
        esquema_ocular: { ...form.esquema_ocular, [side]: value },
      }),
    patient = patients.find(
      (p) => String(p.id_paciente) === String(form.id_paciente),
    );
  return (
    <section className="module-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Evaluación clínica</span>
          <h1>Exámenes visuales</h1>
          <p>Registro estructurado y esquema ocular por colores.</p>
        </div>
        <button
          onClick={() => {
            setOpen(!open);
            setForm(empty);
            setEdit(null);
          }}
        >
          <Plus size={17} />
          {open ? "Cancelar" : "Nuevo examen"}
        </button>
      </header>
      {message && <div className="notice">{message}</div>}
      {open && (
        <form className="clinical-section" onSubmit={save}>
          <h2>
            <Activity size={19} />
            {edit ? "Actualizar examen" : "Registro visual"}
          </h2>
          <div className="field-grid cols-3">
            <label>
              Paciente
              <select
                required
                disabled={Boolean(edit)}
                value={form.id_paciente}
                onChange={(e) =>
                  setForm({ ...form, id_paciente: e.target.value, id_cita: "" })
                }
              >
                <option value="">Seleccione</option>
                {patients.map((p) => (
                  <option key={p.id_paciente} value={p.id_paciente}>
                    {p.apellido} {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cita pagada
              <select
                required
                disabled={Boolean(edit)}
                value={form.id_cita}
                onChange={(e) => setForm({ ...form, id_cita: e.target.value })}
              >
                <option value="">Seleccione</option>
                {appointments
                  .filter(
                    (c) =>
                      !form.id_paciente ||
                      String(c.id_paciente) === String(form.id_paciente),
                  )
                  .map((c) => (
                    <option key={c.id_cita} value={c.id_cita}>
                      #{c.id_cita} · {String(c.fecha_cita).slice(0, 10)}
                    </option>
                  ))}
              </select>
            </label>
            {["ojo_derecho", "ojo_izquierdo", "diagnostico"].map((k) => (
              <label key={k}>
                {k.replaceAll("_", " ")}
                <input
                  value={form[k] || ""}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <h3>Probador virtual de monturas</h3>
          <VirtualTryOn patient={patient} products={products} />
          <div className="eye-diagrams">
            <EyeDiagram
              side="od"
              value={form.esquema_ocular.od}
              onChange={(v) => setEye("od", v)}
            />
            <EyeDiagram
              side="oi"
              value={form.esquema_ocular.oi}
              onChange={(v) => setEye("oi", v)}
            />
          </div>
          <label className="wide">
            Observación
            <textarea
              value={form.observacion || ""}
              onChange={(e) =>
                setForm({ ...form, observacion: e.target.value })
              }
            />
          </label>
          <div className="form-actions">
            <button>Guardar examen</button>
          </div>
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>OD</th>
              <th>OI</th>
              <th>Diagnóstico</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id_examen}>
                <td>
                  {row.paciente_apellido} {row.paciente_nombre}
                </td>
                <td>
                  <span
                    className="color-dot"
                    style={{ background: row.esquema_ocular?.od?.color }}
                  />
                  {row.esquema_ocular?.od?.hallazgo || row.ojo_derecho || "—"}
                </td>
                <td>
                  <span
                    className="color-dot"
                    style={{ background: row.esquema_ocular?.oi?.color }}
                  />
                  {row.esquema_ocular?.oi?.hallazgo || row.ojo_izquierdo || "—"}
                </td>
                <td>{row.diagnostico || "—"}</td>
                <td>{new Date(row.fecha_examen).toLocaleString()}</td>
                <td>
                  <button onClick={() => startEdit(row)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
