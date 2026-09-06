import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import { imageToDataUrl } from "../utils/imageFile";
import { EmptyState, ErrorState, LoadingState } from "./ui";

export function CrudPage({
  title,
  endpoint,
  columns,
  fields,
  createLabel = "Nuevo registro",
  transform,
  rowAction,
  allowCreate = true,
  allowEdit = false,
}) {
  const initial = Object.fromEntries(
    fields.map((field) => [field.name, field.defaultValue ?? ""]),
  );
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [editId,setEditId]=useState(null);
  const [query,setQuery]=useState(""),[page,setPage]=useState(1);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(endpoint);
      setRows(Array.isArray(data) ? data : data ? [data] : []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await apiFetch(editId?`${endpoint}/${editId}`:endpoint, {
        method: editId?"PUT":"POST",
        body: transform ? transform(form) : form,
      });
      setForm(initial);
      setOpen(false);
      setEditId(null);
      setMessage("Registro guardado correctamente");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };
  const filtered=rows.filter((row)=>!query.trim()||Object.values(row).some((value)=>String(value??"").toLowerCase().includes(query.trim().toLowerCase())));
  const pageSize=15,pages=Math.max(1,Math.ceil(filtered.length/pageSize)),visible=filtered.slice((page-1)*pageSize,page*pageSize);

  return (
    <section className="module-page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{rows.length} registros</p>
        </div>
        {allowCreate && (
          <button type="button" onClick={() => {setOpen(!open);setEditId(null);setForm(initial)}}>
            {open ? "Cancelar" : createLabel}
          </button>
        )}
      </header>
      {message && (rows.length?<div className="notice">{message}</div>:<ErrorState message={message} onRetry={load}/>)}
      {allowCreate && open && (
        <form className="form-grid" onSubmit={submit}>
          {fields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.options ? (
                <select
                  required={field.required}
                  value={form[field.name]}
                  onChange={(e) =>
                    setForm({ ...form, [field.name]: e.target.value })
                  }
                >
                  <option value="">Seleccione</option>
                  {field.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  required={field.required}
                  value={form[field.name]}
                  onChange={(e) =>
                    setForm({ ...form, [field.name]: e.target.value })
                  }
                />
              ) : field.type === "file" ? (
                <>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      try {
                        const value = await imageToDataUrl(e.target.files[0]);
                        setForm({ ...form, [field.name]: value });
                      } catch (error) {
                        setMessage(error.message);
                      }
                    }}
                  />
                  {form[field.name] && (
                    <img
                      className="image-preview"
                      src={form[field.name]}
                      alt="Vista previa"
                    />
                  )}
                </>
              ) : field.type === "multifile" ? (
                <MultiFile
                  valor={Array.isArray(form[field.name]) ? form[field.name] : []}
                  onCambio={(lista) => setForm({ ...form, [field.name]: lista })}
                  onError={setMessage}
                />
              ) : (
                <input
                  type={field.type || "text"}
                  required={field.required}
                  step={field.step}
                  value={form[field.name]}
                  onChange={(e) =>
                    setForm({ ...form, [field.name]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          <div className="form-actions">
            <button type="submit">Guardar</button>
          </div>
        </form>
      )}
      <div className="table-toolbar"><label>Buscar<input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder={`Buscar en ${title.toLowerCase()}`}/></label><span className="result-count">{filtered.length} resultados</span></div>
      {loading?<LoadingState/>:<div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              {(rowAction||allowEdit) && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {!loading &&
              visible.map((row, index) => (
                <tr
                  key={
                    row.id_historia ||
                    row.id_receta ||
                    row.id_producto ||
                    row.id_orden_compra ||
                    index
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.key.includes("imagen") && row[c.key] ? (
                        <img className="table-thumb" src={row[c.key]} alt="" />
                      ) : typeof row[c.key] === "object" ? (
                        JSON.stringify(row[c.key])
                      ) : (
                        String(row[c.key] ?? "")
                      )}
                    </td>
                  ))}
                  {(rowAction||allowEdit) && (
                    <td>
                      {allowEdit&&<button type="button" onClick={()=>{setEditId(row.id_producto||row.id_registro);setForm(Object.fromEntries(fields.map(f=>[f.name,row[f.name]??""])));setOpen(true);window.scrollTo({top:0,behavior:"smooth"})}}>Editar</button>}
                      {rowAction&&<button type="button" onClick={() => rowAction(row)}>
                        {rowAction.label || "Abrir"}
                      </button>}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
        {!filtered.length && <EmptyState/>}
      </div>}
      {!loading&&filtered.length>pageSize&&<div className="pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page} de {pages}</span><button className="secondary" disabled={page===pages} onClick={()=>setPage(page+1)}>Siguiente</button></div>}
    </section>
  );
}

/**
 * Carga de varias imagenes con previsualizacion, borrado y reordenamiento.
 * Guarda un array de data URLs (base64) en el formulario; el orden del array es
 * el orden del carrusel en el catalogo. Cada archivo se comprime en el cliente.
 */
function MultiFile({ valor, onCambio, onError }) {
  const MAX = 8;

  const agregar = async (event) => {
    const archivos = Array.from(event.target.files || []);
    event.target.value = ""; // permite volver a elegir los mismos archivos
    try {
      const nuevas = [];
      for (const archivo of archivos) {
        if (valor.length + nuevas.length >= MAX) break;
        nuevas.push(await imageToDataUrl(archivo));
      }
      onCambio([...valor, ...nuevas].slice(0, MAX));
    } catch (error) {
      onError?.(error.message);
    }
  };

  const quitar = (i) => onCambio(valor.filter((_, j) => j !== i));

  const mover = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= valor.length) return;
    const copia = [...valor];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onCambio(copia);
  };

  return (
    <>
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={agregar} />
      {valor.length > 0 && (
        <div className="multifile-grid">
          {valor.map((src, i) => (
            <div key={i} className="multifile-item">
              <img src={src} alt={`Imagen ${i + 1}`} />
              <span className="multifile-orden">{i + 1}</span>
              <div className="multifile-acciones">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir">↑</button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === valor.length - 1} title="Bajar">↓</button>
                <button type="button" className="quitar" onClick={() => quitar(i)} title="Quitar">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <small className="multifile-nota">{valor.length}/{MAX} imágenes. La primera es la portada del carrusel.</small>
    </>
  );
}
