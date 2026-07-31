import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { imageToDataUrl } from "../../utils/imageFile";

const empty = {
  nombre: "",
  apellido: "",
  cedula: "",
  telefono: "",
  correo: "",
  direccion: "",
  fecha_nacimiento: "",
  lugar_nacimiento: "",
  genero: "",
  ocupacion: "",
  procedencia: "",
  uso_lentes: false,
  ultimo_control: "",
  foto_data: "",
  forma_rostro: "",
};
const fields = [
  ["nombre", "text", true],
  ["apellido", "text", true],
  ["cedula", "text", true],
  ["fecha_nacimiento", "date", true],
  ["lugar_nacimiento", "place", true],
  ["genero", "select", true],
  ["ocupacion", "occupation", true],
  ["telefono", "tel", true],
  ["correo", "email"],
  ["direccion", "textarea", true],
  ["procedencia", "text"],
  ["ultimo_control", "date"],
];
const title = (key) =>
  key.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
const provinces=["Azuay","Bolívar","Cañar","Carchi","Chimborazo","Cotopaxi","El Oro","Esmeraldas","Galápagos","Guayas","Imbabura","Loja","Los Ríos","Manabí","Morona Santiago","Napo","Orellana","Pastaza","Pichincha","Santa Elena","Santo Domingo de los Tsáchilas","Sucumbíos","Tungurahua","Zamora Chinchipe","Exterior"];
const occupations=["Estudiante","Empleado privado","Empleado público","Comerciante","Docente","Profesional independiente","Jubilado","Trabajo del hogar","Desempleado","Otro"];

export default function Pacientes() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]),
    [form, setForm] = useState(empty),
    [edit, setEdit] = useState(null),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [activeFilter,setActiveFilter]=useState("true"),[message, setMessage] = useState(""),
    [page,setPage]=useState(1),[pagination,setPagination]=useState({total:0,pages:1}),[selected,setSelected]=useState(null),[loading,setLoading]=useState(true);
  const load = useCallback(async () => {
    try {
      setLoading(true);const params=new URLSearchParams({activo:activeFilter,paginado:"true",page:String(page),pageSize:"15"});if(query.trim())params.set("q",query.trim());const data=await apiFetch(`/pacientes?${params}`);setRows(data.rows);setPagination(data);
    } catch (error) {
      setMessage(error.message);
    } finally { setLoading(false); }
  }, [query,activeFilter,page]);
  useEffect(() => {
    load();
  }, [load]);
  const visible = rows;
  const close = () => {
    setOpen(false);
    setEdit(null);
    setForm(empty);
  };
  const save = async (event) => {
    event.preventDefault();
    try {
      await apiFetch(edit ? `/pacientes/${edit}` : "/pacientes", {
        method: edit ? "PUT" : "POST",
        body: form,
      });
      setMessage(edit ? "Paciente actualizado" : "Paciente registrado");
      close();
      load();
    } catch (error) {
      setMessage(error.message);
    }
  };
  const startEdit = (row) => {
    setEdit(row.id_paciente);
    setForm({
      ...empty,
      ...row,
      fecha_nacimiento: String(row.fecha_nacimiento || "").slice(0, 10),
      ultimo_control: String(row.ultimo_control || "").slice(0, 10),
    });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (id) => {
    if (
      !window.confirm(
        "¿Desactivar este paciente? Su expediente clínico se conservará.",
      )
    )
      return;
    try {
      await apiFetch(`/pacientes/${id}`, { method: "DELETE" });
      setMessage("Paciente desactivado");
      load();
    } catch (error) {
      setMessage(error.message);
    }
  };
  const canCreate = ["Administrador", "Optometra", "Vendedor"].includes(
      user?.rol,
    ),
    canEdit = ["Administrador", "Optometra"].includes(user?.rol);
  return (
    <section className="module-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Directorio clínico</span>
          <h1>Pacientes</h1>
          <p>{rows.length} expedientes activos</p>
        </div>
        {canCreate && (
          <button onClick={() => (open ? close() : setOpen(true))}>
            {open ? (
              "Cancelar"
            ) : (
              <>
                <Plus size={17} /> Nuevo paciente
              </>
            )}
          </button>
        )}
      </header>
      {message && <div className="notice">{message}</div>}
      {open && (
        <form className="clinical-section" onSubmit={save}>
          <h2>
            <UserRound size={19} />
            {edit ? "Actualizar paciente" : "Datos personales"}
          </h2>
          <div className="patient-photo-field">
            <label>
              Foto frontal
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  try {
                    setForm({
                      ...form,
                      foto_data: await imageToDataUrl(e.target.files[0]),
                    });
                  } catch (error) {
                    setMessage(error.message);
                  }
                }}
              />
            </label>
            {form.foto_data ? (
              <img src={form.foto_data} alt="Paciente" />
            ) : (
              <UserRound size={70} />
            )}
          </div>
          <div className="field-grid">
            <label>
              Forma del rostro
              <select
                value={form.forma_rostro}
                onChange={(e) =>
                  setForm({ ...form, forma_rostro: e.target.value })
                }
              >
                <option value="">Por determinar</option>
                {[
                  "Ovalado",
                  "Redondo",
                  "Cuadrado",
                  "Corazón",
                  "Alargado",
                  "Diamante",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            {fields.map(([key, type, required]) => (
              <label key={key}>
                {title(key)}
                {type === "textarea" ? (
                  <textarea
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                ) : ["select","place","occupation"].includes(type) ? (
                  <select
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  >
                    <option value="">Seleccione</option>
                    {(type==="place"?provinces:type==="occupation"?occupations:["Femenino","Masculino","Otro","Prefiere no indicar"]).map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={required}
                    type={type}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.uso_lentes}
                onChange={(e) =>
                  setForm({ ...form, uso_lentes: e.target.checked })
                }
              />
              Usa lentes actualmente
            </label>
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button>Guardar paciente</button>
            <button type="button" className="secondary" onClick={close}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {!open && (
        <>
          <div className="table-toolbar">
            <label>
              Buscar paciente
              <div className="input-icon">
                <Search />
                <input
                  value={query}
                  onChange={(e) => {setQuery(e.target.value);setPage(1)}}
                  placeholder="Nombre, cédula, teléfono o correo"
                />
              </div>
            </label>
            <label>Estado<select value={activeFilter} onChange={e=>{setActiveFilter(e.target.value);setPage(1)}}><option value="true">Activos</option><option value="false">Inactivos</option><option value="todos">Todos</option></select></label>
            <span className="result-count">{pagination.total} pacientes</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CI</th>
                  <th>Paciente</th>
                  <th>Contacto</th>
                  <th>Ocupación</th>
                  <th>Uso de lentes</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id_paciente}>
                    <td>{row.cedula}</td>
                    <td>
                      <div className="patient-name">
                        {row.foto_data ? (
                          <img
                            className="table-thumb"
                            src={row.foto_data}
                            alt=""
                          />
                        ) : (
                          <UserRound />
                        )}
                        <span>
                          <strong>
                            {row.apellido} {row.nombre}
                          </strong>
                          <br />
                          {row.forma_rostro || "Rostro sin clasificar"}
                        </span>
                      </div>
                    </td>
                    <td>{row.telefono || "—"}</td>
                    <td>{row.ocupacion || "—"}</td>
                    <td>{row.uso_lentes ? "Sí" : "No"}</td>
                    <td>
                      <button className="secondary" onClick={()=>setSelected(row)}><Eye size={14}/> Ver</button>
                      {canEdit && (
                        <button onClick={() => startEdit(row)}>
                          <Pencil size={14} /> Editar
                        </button>
                      )}
                      {user?.rol === "Administrador" && (
                        <button
                          className="secondary"
                          onClick={() => remove(row.id_paciente)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !visible.length && (
              <div className="empty">No se encontraron pacientes.</div>
            )}
          </div>
          <div className="pagination"><button className="secondary" disabled={page<=1} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page} de {pagination.pages}</span><button className="secondary" disabled={page>=pagination.pages} onClick={()=>setPage(page+1)}>Siguiente</button></div>
        </>
      )}
      {selected&&<div className="drawer-backdrop" onMouseDown={()=>setSelected(null)}><aside className="drawer" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><header><div><span className="eyebrow">Resumen del paciente</span><h2>{selected.apellido} {selected.nombre}</h2></div><button className="icon-button secondary" onClick={()=>setSelected(null)} aria-label="Cerrar"><X/></button></header><div className="patient-summary-card">{selected.foto_data?<img src={selected.foto_data} alt=""/>:<span className="profile-avatar"><UserRound/></span>}<div><strong>{selected.cedula}</strong><span>{selected.activo?"Paciente activo":"Paciente inactivo"}</span></div></div><dl className="appointment-detail"><div><dt>Teléfono</dt><dd>{selected.telefono||"Sin registro"}</dd></div><div><dt>Correo</dt><dd>{selected.correo||"Sin registro"}</dd></div><div><dt>Nacimiento</dt><dd>{String(selected.fecha_nacimiento||"").slice(0,10)}</dd></div><div><dt>Ocupación</dt><dd>{selected.ocupacion||"Sin registro"}</dd></div><div><dt>Último control</dt><dd>{String(selected.ultimo_control||"").slice(0,10)||"Sin registro"}</dd></div><div><dt>Usa lentes</dt><dd>{selected.uso_lentes?"Sí":"No"}</dd></div></dl>{canEdit&&<button onClick={()=>{setSelected(null);startEdit(selected)}}><Pencil size={15}/>Editar datos personales</button>}</aside></div>}
    </section>
  );
}
