import {useCallback,useEffect,useState} from "react";
import {apiFetch} from "../../services/api";
import {useAuth} from "../../hooks/useAuth";

export default function Cartera(){
 const{user}=useAuth();const[cobrar,setCobrar]=useState([]),[pagar,setPagar]=useState([]),[seleccion,setSeleccion]=useState(null);
 const[abono,setAbono]=useState({monto:"",forma_pago:"Efectivo"}),[msg,setMsg]=useState("");
 const load=useCallback(async()=>{try{setCobrar(await apiFetch("/cartera/cobrar"));if(user?.rol==="Administrador")setPagar(await apiFetch("/cartera/pagar"))}catch(e){setMsg(e.message)}},[user]);
 useEffect(()=>{load()},[load]);
 const guardar=async()=>{try{await apiFetch(`/cartera/${seleccion.tipo}/${seleccion.id}/abonos`,{method:"POST",body:abono});setSeleccion(null);setAbono({monto:"",forma_pago:"Efectivo"});setMsg("Abono registrado");load()}catch(x){setMsg(x.message)}};
 const tabla=(titulo,rows,tipo)=><><h2>{titulo}</h2><div className="table-wrap"><table><thead><tr><th>Tercero</th><th>Saldo</th><th>Vencimiento</th><th>Estado</th><th>Accion</th></tr></thead><tbody>{rows.map(x=><tr key={x.id_cxc||x.id_cxp}><td>{x.paciente_nombre?`${x.paciente_nombre} ${x.paciente_apellido}`:x.proveedor}</td><td>{x.saldo}</td><td>{String(x.fecha_vencimiento).slice(0,10)}</td><td>{x.antiguedad||x.estado}</td><td><button onClick={()=>setSeleccion({tipo,id:x.id_cxc||x.id_cxp})}>Abonar</button></td></tr>)}</tbody></table></div></>;
 return <section className="module-page"><header className="page-header"><div><h1>Cartera</h1><p>Saldos y vencimientos</p></div></header>{msg&&<div className="notice">{msg}</div>}{seleccion&&<div className="form-grid"><label>Monto<input type="number" step="0.01" value={abono.monto} onChange={e=>setAbono({...abono,monto:e.target.value})}/></label>{seleccion.tipo==="cobrar"&&<label>Forma de pago<select value={abono.forma_pago} onChange={e=>setAbono({...abono,forma_pago:e.target.value})}>{["Efectivo","Tarjeta","Transferencia"].map(x=><option key={x}>{x}</option>)}</select></label>}<div className="form-actions"><button onClick={guardar}>Registrar abono</button><button className="secondary" onClick={()=>setSeleccion(null)}>Cancelar</button></div></div>}{tabla("Cuentas por cobrar",cobrar,"cobrar")}{user?.rol==="Administrador"&&tabla("Cuentas por pagar",pagar,"pagar")}</section>
}
