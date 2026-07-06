import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const empty={nombre:"",apellido:"",cedula:"",telefono:"",correo:"",direccion:"",fecha_nacimiento:"",lugar_nacimiento:"",genero:"",ocupacion:"",procedencia:"",uso_lentes:false,ultimo_control:""};
const fields=[
 ["nombre","text",true],["apellido","text",true],["cedula","text",true],["fecha_nacimiento","date"],
 ["lugar_nacimiento","text"],["genero","select"],["ocupacion","text"],["telefono","tel"],
 ["correo","email"],["direccion","textarea"],["procedencia","text"],["ultimo_control","date"]
];
const title=(key)=>key.replaceAll("_"," ").replace(/\b\w/g,(l)=>l.toUpperCase());

export default function Pacientes(){
 const {user}=useAuth();const[rows,setRows]=useState([]),[form,setForm]=useState(empty),[edit,setEdit]=useState(null),[open,setOpen]=useState(false),[query,setQuery]=useState(""),[message,setMessage]=useState("");
 const load=useCallback(async()=>{try{setRows(await apiFetch("/pacientes"))}catch(error){setMessage(error.message)}},[]);useEffect(()=>{load()},[load]);
 const visible=rows.filter((row)=>Object.values(row).some((value)=>String(value??"").toLowerCase().includes(query.toLowerCase())));
 const close=()=>{setOpen(false);setEdit(null);setForm(empty)};
 const save=async(event)=>{event.preventDefault();try{await apiFetch(edit?`/pacientes/${edit}`:"/pacientes",{method:edit?"PUT":"POST",body:form});setMessage(edit?"Paciente actualizado":"Paciente registrado");close();load()}catch(error){setMessage(error.message)}};
 const startEdit=(row)=>{setEdit(row.id_paciente);setForm({...empty,...row,fecha_nacimiento:String(row.fecha_nacimiento||"").slice(0,10),ultimo_control:String(row.ultimo_control||"").slice(0,10)});setOpen(true);window.scrollTo({top:0,behavior:"smooth"})};
 const remove=async(id)=>{if(!window.confirm("¿Desactivar este paciente? Su expediente clínico se conservará."))return;try{await apiFetch(`/pacientes/${id}`,{method:"DELETE"});setMessage("Paciente desactivado");load()}catch(error){setMessage(error.message)}};
 const canCreate=["Administrador","Optometra","Vendedor"].includes(user?.rol),canEdit=["Administrador","Optometra"].includes(user?.rol);
 return <section className="module-page"><header className="page-header"><div><span className="eyebrow">Directorio clínico</span><h1>Pacientes</h1><p>{rows.length} expedientes activos</p></div>{canCreate&&<button onClick={()=>open?close():setOpen(true)}>{open?"Cancelar":<><Plus size={17}/> Nuevo paciente</>}</button>}</header>
 {message&&<div className="notice">{message}</div>}
 {open&&<form className="clinical-section" onSubmit={save}><h2><UserRound size={19}/>{edit?"Actualizar paciente":"Datos personales"}</h2><div className="field-grid">{fields.map(([key,type,required])=><label key={key}>{title(key)}{type==="textarea"?<textarea value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})}/>:type==="select"?<select value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})}><option value="">Seleccione</option>{["Femenino","Masculino","Otro","Prefiere no indicar"].map((item)=><option key={item}>{item}</option>)}</select>:<input required={required} type={type} value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})}/>}</label>)}<label className="checkbox-label"><input type="checkbox" checked={form.uso_lentes} onChange={(e)=>setForm({...form,uso_lentes:e.target.checked})}/>Usa lentes actualmente</label></div><div className="form-actions" style={{marginTop:16}}><button>Guardar paciente</button><button type="button" className="secondary" onClick={close}>Cancelar</button></div></form>}
 {!open&&<><div className="form-grid"><label>Buscar paciente<div className="input-icon"><Search/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Nombre, cédula, teléfono o correo"/></div></label></div><div className="table-wrap"><table><thead><tr><th>CI</th><th>Paciente</th><th>Contacto</th><th>Ocupación</th><th>Uso de lentes</th><th>Acciones</th></tr></thead><tbody>{visible.map((row)=><tr key={row.id_paciente}><td>{row.cedula}</td><td><strong>{row.apellido} {row.nombre}</strong><br/><span>{row.correo||"Sin correo"}</span></td><td>{row.telefono||"—"}</td><td>{row.ocupacion||"—"}</td><td>{row.uso_lentes?"Sí":"No"}</td><td>{canEdit&&<button onClick={()=>startEdit(row)}><Pencil size={14}/> Editar</button>}{user?.rol==="Administrador"&&<button className="secondary" onClick={()=>remove(row.id_paciente)}><Trash2 size={14}/></button>}</td></tr>)}</tbody></table>{!visible.length&&<div className="empty">No se encontraron pacientes.</div>}</div></>}
 </section>;
}
