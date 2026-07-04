import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../services/api";

export function CrudPage({ title, endpoint, columns, fields, createLabel = "Nuevo registro", transform, rowAction, allowCreate = true }) {
    const initial = Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""]));
    const [rows, setRows] = useState([]);
    const [form, setForm] = useState(initial);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await apiFetch(endpoint);
            setRows(Array.isArray(data) ? data : data ? [data] : []);
        } catch (error) { setMessage(error.message); }
        finally { setLoading(false); }
    }, [endpoint]);

    useEffect(() => { load(); }, [load]);

    const submit = async (event) => {
        event.preventDefault();
        try {
            await apiFetch(endpoint, { method: "POST", body: transform ? transform(form) : form });
            setForm(initial); setOpen(false); setMessage("Registro guardado correctamente"); await load();
        } catch (error) { setMessage(error.message); }
    };

    return <section className="module-page">
        <header className="page-header"><div><h1>{title}</h1><p>{rows.length} registros</p></div>
            {allowCreate&&<button type="button" onClick={() => setOpen(!open)}>{open ? "Cancelar" : createLabel}</button>}</header>
        {message && <div className="notice">{message}</div>}
        {allowCreate&&open && <form className="form-grid" onSubmit={submit}>
            {fields.map((field) => <label key={field.name}>{field.label}
                {field.options ? <select required={field.required} value={form[field.name]} onChange={(e)=>setForm({...form,[field.name]:e.target.value})}><option value="">Seleccione</option>{field.options.map(o=><option key={o} value={o}>{o}</option>)}</select>
                : field.type === "textarea" ? <textarea required={field.required} value={form[field.name]} onChange={(e) => setForm({...form,[field.name]:e.target.value})}/>
                : <input type={field.type || "text"} required={field.required} step={field.step} value={form[field.name]} onChange={(e) => setForm({...form,[field.name]:e.target.value})}/>}</label>)}
            <div className="form-actions"><button type="submit">Guardar</button></div>
        </form>}
        <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}{rowAction&&<th>Accion</th>}</tr></thead>
            <tbody>{!loading && rows.map((row,index)=><tr key={row.id_historia||row.id_receta||row.id_producto||row.id_orden_compra||index}>{columns.map(c=><td key={c.key}>{typeof row[c.key]==="object"?JSON.stringify(row[c.key]):String(row[c.key]??"")}</td>)}{rowAction&&<td><button type="button" onClick={()=>rowAction(row)}>{rowAction.label||"Abrir"}</button></td>}</tr>)}</tbody></table>
            {loading && <p className="empty">Cargando...</p>}{!loading&&!rows.length&&<p className="empty">Sin registros</p>}</div>
    </section>;
}
