import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Eye, FileHeart, Glasses, Printer, Save, ScanEye, Stethoscope, X } from "lucide-react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const sections = {
  lensometria:["od","oi","ao","add","prismas","av_vl_cc","av_vp_cc","tipo_lente","material","filtro","tiempo_uso","distancia_pupilar","observaciones"],
  agudeza_visual:["av_vl_sc_od","av_vl_sc_oi","av_vl_sc_ao","av_vp_sc_od","av_vp_sc_oi","av_vp_sc_ao","distancia_lejos","distancia_cerca","ph","dominancia","optotipo"],
  examen_externo:["orbita_cejas_od","orbita_cejas_oi","parpados_pestanas_od","parpados_pestanas_oi","sistema_lagrimal_od","sistema_lagrimal_oi","conjuntiva_esclera_od","conjuntiva_esclera_oi","cornea_camara_od","cornea_camara_oi","iris_pupila_od","iris_pupila_oi","cristalino_od","cristalino_oi","tests_adicionales"],
  reflejos_pupilares:["consensual_od","consensual_oi","fotomotor_od","fotomotor_oi","acomodativo_od","acomodativo_oi"],
  oftalmoscopia:["papila_excavacion_od","papila_excavacion_oi","vasos_od","vasos_oi","macula_fijacion_od","macula_fijacion_oi","tapete_od","tapete_oi","regularidad_color_od","regularidad_color_oi"],
  examen_motor:["nivel_visual","kappa","hirschberg","cover_test","ppc","luces_worth","maddox","ducciones","versiones"],
  queratometria_refraccion:["queratometria_od","queratometria_oi","miras","astigmatismo_corneal","rx_estatica","rx_dinamica","subjetivo","afinacion","balance_binocular","prueba_ambulatoria","rx_final","add","dnp","av_vl","av_vp"],
  diagnostico:["cie10","diagnostico_od","diagnostico_oi","diagnostico_motor","patologico_presuntivo"]
};
const emptyObject = (keys) => Object.fromEntries(keys.map((key)=>[key,""]));
const initial = {
  id_paciente:"",id_cita:"",consultorio:"",motivo:"",
  anamnesis_general:"",antecedentes_personales_oculares:"",antecedentes_personales_generales:"",
  antecedentes_familiares_oculares:"",antecedentes_familiares_generales:"",
  ...Object.fromEntries(Object.entries(sections).map(([key,keys])=>[key,emptyObject(keys)])),
  observaciones_patologicas:"",tratamiento:"",nombre_examinador:"",nivel_paralelo:"",jornada:"",
  consentimiento_informado:false,firma_paciente:"",observacion:""
};
const label = (value) => value.replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());
const Field = ({name,value,onChange,type="text",wide=false,required=false}) => <label className={wide?"wide":""}>{label(name)}{type==="textarea"?<textarea value={value??""} required={required} onChange={(e)=>onChange(e.target.value)}/>:<input type={type} value={value??""} required={required} onChange={(e)=>onChange(e.target.value)}/>}</label>;
const slug = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
const Section = ({icon:Icon,title,children}) => <section id={slug(title)} className="clinical-section"><h2><Icon size={19}/>{title}</h2>{children}</section>;
const ObjectFields = ({value,keys,onChange,cols=3}) => <div className={`field-grid cols-${cols}`}>{keys.map((key)=><Field key={key} name={key} value={value?.[key]} onChange={(next)=>onChange({...value,[key]:next})} wide={key.includes("observaciones")}/>)}</div>;
const clinicalColor=(text)=>{const value=String(text||"").toLowerCase();if(/normal|sano|sin alter/.test(value))return "#22c55e";if(/catarata|opacidad/.test(value))return "#94a3b8";if(/pterigion|amarill/.test(value))return "#f59e0b";if(/inflama|edema/.test(value))return "#f97316";if(/lesion|úlcera|ulcera/.test(value))return "#8b5cf6";if(value.trim())return "#ef4444";return "#38bdf8"};
const ClinicalEye=({side,text})=>{const color=clinicalColor(text);return <div className="eye-editor"><strong>{side}</strong><svg viewBox="0 0 240 125"><path d="M12 63 Q60 8 120 12 Q180 8 228 63 Q180 117 120 113 Q60 117 12 63Z" fill="#fff" stroke="#31566a" strokeWidth="5"/><circle cx="120" cy="63" r="39" fill={color} opacity=".35"/><circle cx="120" cy="63" r="22" fill={color}/><circle cx="120" cy="63" r="9" fill="#111827"/><circle cx="111" cy="53" r="5" fill="#fff" opacity=".8"/></svg><small>{text||"Sin hallazgos registrados"}</small></div>};

export default function HistoriaClinica(){
  const { user }=useAuth();
  const esAdmin=user?.rol==="Administrador";
  const [rows,setRows]=useState([]),[patients,setPatients]=useState([]),[appointments,setAppointments]=useState([]),[codes,setCodes]=useState([]);
  const [form,setForm]=useState(initial),[edit,setEdit]=useState(null),[open,setOpen]=useState(false),[message,setMessage]=useState("");
  const load=useCallback(async()=>{try{const [h,p,c,cie]=await Promise.all([apiFetch("/historia"),apiFetch("/pacientes"),apiFetch("/citas"),apiFetch("/historia/cie10/catalogo")]);setRows(h);setPatients(p);setAppointments(c.filter((item)=>item.pago_previo&&!["Cancelada","No asistio"].includes(item.estado)));setCodes(cie)}catch(error){setMessage(error.message)}},[]);
  useEffect(()=>{load()},[load]);
  const patient=useMemo(()=>patients.find((item)=>String(item.id_paciente)===String(form.id_paciente)),[patients,form.id_paciente]);
  const availableAppointments=appointments.filter((item)=>!form.id_paciente||String(item.id_paciente)===String(form.id_paciente));
  const setObject=(section,value)=>setForm((current)=>({...current,[section]:value}));
  const close=()=>{setOpen(false);setEdit(null);setForm(initial)};
  const save=async(event)=>{event.preventDefault();try{await apiFetch(edit?`/historia/${edit}`:"/historia",{method:edit?"PUT":"POST",body:{...form,diagnostico_cie10:form.diagnostico.cie10}});setMessage("Historia clínica guardada correctamente");close();load()}catch(error){setMessage(error.message)}};
  const editRow=(row)=>{const merged={...initial,...row};for(const key of Object.keys(sections))merged[key]={...initial[key],...(row[key]||{})};setForm(merged);setEdit(row.id_historia);setOpen(true);window.scrollTo({top:0,behavior:"smooth"})};
  const block=async(id)=>{try{await apiFetch(`/historia/${id}/bloquear`,{method:"POST"});setMessage("Historia cerrada y protegida legalmente");load()}catch(error){setMessage(error.message)}};
  const desbloquear=async(id)=>{const observacion=window.prompt("Motivo de la autorización para reabrir esta historia (obligatorio):");if(!observacion||!observacion.trim())return;try{const r=await apiFetch(`/historia/${id}/desbloquear`,{method:"POST",body:{observacion:observacion.trim()}});setMessage(r.mensaje||"Historia desbloqueada");load()}catch(error){setMessage(error.message)}};
  const printRow=(row)=>{editRow(row);setTimeout(()=>window.print(),250)};
  return <section className="module-page">
    <header className="page-header"><div><span className="eyebrow">Expediente optométrico</span><h1>Historia clínica</h1><p>Registro estructurado, cifrado y editable durante 24 horas.</p></div><button onClick={()=>open?close():(setOpen(true),setForm(initial))}>{open?<><X size={17}/> Cancelar</>:<><FileHeart size={17}/> Nueva historia</>}</button></header>
    {message&&<div className={`notice ${message.toLowerCase().includes("error")?"error":""}`}>{message}</div>}
    {open&&<><nav className="clinical-progress" aria-label="Secciones de historia clínica">{["Datos generales","Anamnesis","Lensometría","Agudeza visual","Examen externo / Biomicroscopía","Reflejos pupilares","Oftalmoscopía","Examen motor","Diagnóstico y tratamiento","Consentimiento y firma"].map((item,index)=><a href={`#${slug(item)}`} key={item}><span>{index+1}</span>{item}</a>)}</nav><form className="clinical-form" onSubmit={save}>
      <Section icon={FileHeart} title="Datos generales">
        <div className="field-grid">
          <label>Paciente<select required disabled={Boolean(edit)} value={form.id_paciente} onChange={(e)=>setForm({...form,id_paciente:e.target.value,id_cita:""})}><option value="">Seleccione un paciente</option>{patients.map((p)=><option value={p.id_paciente} key={p.id_paciente}>{p.apellido} {p.nombre} · {p.cedula}</option>)}</select></label>
          <label>Cita pagada<select required disabled={Boolean(edit)} value={form.id_cita} onChange={(e)=>{const ap=appointments.find((a)=>String(a.id_cita)===e.target.value);setForm({...form,id_cita:e.target.value,consultorio:ap?.consultorio||form.consultorio})}}><option value="">Seleccione una cita</option>{availableAppointments.map((c)=><option value={c.id_cita} key={c.id_cita}>#{c.id_cita} · {String(c.fecha_cita).slice(0,10)} {c.hora_cita}</option>)}</select></label>
          <Field name="consultorio" value={form.consultorio} onChange={(value)=>setForm({...form,consultorio:value})}/>
          <Field name="nombre_examinador" value={form.nombre_examinador} onChange={(value)=>setForm({...form,nombre_examinador:value})}/>
          <Field name="nivel_paralelo" value={form.nivel_paralelo} onChange={(value)=>setForm({...form,nivel_paralelo:value})}/>
          <Field name="jornada" value={form.jornada} onChange={(value)=>setForm({...form,jornada:value})}/>
        </div>
        {patient&&<div className="summary-grid" style={{marginTop:16}}><article><span>Paciente</span><strong style={{fontSize:16}}>{patient.nombre} {patient.apellido}</strong></article><article><span>CI</span><strong style={{fontSize:16}}>{patient.cedula}</strong></article><article><span>Nacimiento</span><strong style={{fontSize:16}}>{String(patient.fecha_nacimiento||"—").slice(0,10)}</strong></article><article><span>Contacto</span><strong style={{fontSize:16}}>{patient.telefono||"—"}</strong></article></div>}
        <div className="field-grid" style={{marginTop:14}}><Field name="motivo_de_consulta" value={form.motivo} onChange={(value)=>setForm({...form,motivo:value})} type="textarea" wide required/></div>
      </Section>
      <Section icon={Stethoscope} title="Anamnesis"><div className="field-grid cols-3">
        {["anamnesis_general","antecedentes_personales_oculares","antecedentes_personales_generales","antecedentes_familiares_oculares","antecedentes_familiares_generales"].map((key)=><Field key={key} name={key} value={form[key]} onChange={(value)=>setForm({...form,[key]:value})} type="textarea" wide={key==="anamnesis_general"}/>)}
      </div></Section>
      <Section icon={Glasses} title="Lensometría"><ObjectFields keys={sections.lensometria} value={form.lensometria} onChange={(value)=>setObject("lensometria",value)}/></Section>
      <Section icon={Eye} title="Agudeza visual"><ObjectFields keys={sections.agudeza_visual} value={form.agudeza_visual} onChange={(value)=>setObject("agudeza_visual",value)}/></Section>
      <Section icon={ScanEye} title="Examen externo / Biomicroscopía"><ObjectFields keys={sections.examen_externo} value={form.examen_externo} onChange={(value)=>setObject("examen_externo",value)}/></Section>
      <Section icon={Eye} title="Mapa ocular clínico"><p>Vista orientativa por colores basada en los hallazgos escritos; no reemplaza la valoración profesional.</p><div className="eye-diagrams"><ClinicalEye side="Ojo derecho (OD)" text={[form.examen_externo?.conjuntiva_esclera_od,form.examen_externo?.cornea_camara_od,form.examen_externo?.cristalino_od,form.diagnostico?.diagnostico_od].filter(Boolean).join(" · ")}/><ClinicalEye side="Ojo izquierdo (OI)" text={[form.examen_externo?.conjuntiva_esclera_oi,form.examen_externo?.cornea_camara_oi,form.examen_externo?.cristalino_oi,form.diagnostico?.diagnostico_oi].filter(Boolean).join(" · ")}/></div></Section>
      <Section icon={Activity} title="Reflejos pupilares"><ObjectFields keys={sections.reflejos_pupilares} value={form.reflejos_pupilares} onChange={(value)=>setObject("reflejos_pupilares",value)}/></Section>
      <Section icon={Eye} title="Oftalmoscopía"><ObjectFields keys={sections.oftalmoscopia} value={form.oftalmoscopia} onChange={(value)=>setObject("oftalmoscopia",value)}/></Section>
      <Section icon={Activity} title="Examen motor"><ObjectFields keys={sections.examen_motor} value={form.examen_motor} onChange={(value)=>setObject("examen_motor",value)}/></Section>
      <Section icon={ScanEye} title="Queratometría y refracción"><ObjectFields keys={sections.queratometria_refraccion} value={form.queratometria_refraccion} onChange={(value)=>setObject("queratometria_refraccion",value)}/></Section>
      <Section icon={CheckCircle2} title="Diagnóstico y tratamiento">
        <div className="field-grid cols-3">
          <label>Diagnóstico CIE-10<select value={form.diagnostico.cie10} onChange={(e)=>setObject("diagnostico",{...form.diagnostico,cie10:e.target.value})}><option value="">Seleccione</option>{codes.map((code)=><option key={code.codigo} value={code.codigo}>{code.codigo} · {code.descripcion}</option>)}</select></label>
          {sections.diagnostico.filter((key)=>key!=="cie10").map((key)=><Field key={key} name={key} value={form.diagnostico[key]} onChange={(value)=>setObject("diagnostico",{...form.diagnostico,[key]:value})}/>)}
          <Field name="observaciones_patologicas" value={form.observaciones_patologicas} onChange={(value)=>setForm({...form,observaciones_patologicas:value})} type="textarea" wide/>
          <Field name="tratamiento_disposicion_conducta" value={form.tratamiento} onChange={(value)=>setForm({...form,tratamiento:value})} type="textarea" wide/>
        </div>
      </Section>
      <Section icon={CheckCircle2} title="Consentimiento y firma"><div className="field-grid cols-3"><label className="checkbox-label"><input type="checkbox" checked={form.consentimiento_informado} onChange={(e)=>setForm({...form,consentimiento_informado:e.target.checked})}/>Consentimiento informado aceptado</label><Field name="firma_paciente" value={form.firma_paciente} onChange={(value)=>setForm({...form,firma_paciente:value})} required/></div>{edit&&<label className="wide">Motivo de la edición (obligatorio al modificar una historia finalizada)<textarea value={form.observacion??""} onChange={(e)=>setForm({...form,observacion:e.target.value})} placeholder="Describe por qué se modifica la historia"/></label>}</Section>
      <div className="sticky-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button><Save size={17}/> {edit?"Actualizar historia":"Guardar historia"}</button></div>
    </form></>}
    {!open&&<div className="table-wrap"><table><thead><tr><th>N.º</th><th>Paciente</th><th>CIE-10</th><th>Fecha</th><th>Estado legal</th><th>Acciones</th></tr></thead><tbody>{rows.map((row)=><tr key={row.id_historia}><td>HC-{String(row.id_historia).padStart(6,"0")}</td><td>{row.paciente_apellido} {row.paciente_nombre}</td><td>{row.diagnostico_cie10||"—"}</td><td>{new Date(row.creado_en).toLocaleString()}</td><td><span className="status-pill"><span/>{row.bloqueada_legal?"Cerrada":"Editable"}</span></td><td><button className="secondary" onClick={()=>printRow(row)}><Printer size={14}/></button>{!row.bloqueada_legal&&<><button onClick={()=>editRow(row)}>Editar</button><button className="secondary" onClick={()=>block(row.id_historia)}>Cerrar</button></>}{row.bloqueada_legal&&esAdmin&&<button className="secondary" onClick={()=>desbloquear(row.id_historia)}>Desbloquear</button>}</td></tr>)}</tbody></table>{!rows.length&&<div className="empty">No hay historias clínicas registradas.</div>}</div>}
  </section>;
}
