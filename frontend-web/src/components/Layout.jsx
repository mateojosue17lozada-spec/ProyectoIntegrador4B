import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const items=[
 {to:"/dashboard",label:"Resumen",roles:["Administrador","Optometra","Cajero","Vendedor"],end:true},
 {to:"/dashboard/pacientes",label:"Pacientes",roles:["Administrador","Optometra","Cajero","Vendedor"]},
 {to:"/dashboard/citas",label:"Citas",roles:["Administrador","Optometra","Cajero","Vendedor"]},
 {to:"/dashboard/historias",label:"Historias clinicas",roles:["Administrador","Optometra"]},
 {to:"/dashboard/recetas",label:"Recetas y laboratorio",roles:["Administrador","Optometra","Vendedor"]},
 {to:"/dashboard/inventario",label:"Inventario",roles:["Administrador","Cajero","Vendedor"]},
 {to:"/dashboard/compras",label:"Compras",roles:["Administrador"]},
 {to:"/dashboard/facturacion",label:"Facturacion",roles:["Administrador","Cajero"]},
 {to:"/dashboard/caja",label:"Caja",roles:["Administrador","Cajero"]},
 {to:"/dashboard/cartera",label:"Cartera",roles:["Administrador","Cajero"]}
 ,{to:"/dashboard/usuarios",label:"Usuarios y auditoria",roles:["Administrador"]}
];
export const Layout=()=>{const{user,logout}=useAuth();const navigate=useNavigate();const cerrar=async()=>{await logout();navigate("/login")};return <div className="app-shell"><aside className="sidebar"><div className="brand">Optica Integral</div><div className="identity"><strong>{user?.nombre}</strong><span>{user?.rol}</span></div><nav>{items.filter(x=>x.roles.includes(user?.rol)).map(x=><NavLink key={x.to} to={x.to} end={x.end}>{x.label}</NavLink>)}</nav><button className="secondary" onClick={cerrar}>Cerrar sesion</button></aside><main className="content"><Outlet/></main></div>}
