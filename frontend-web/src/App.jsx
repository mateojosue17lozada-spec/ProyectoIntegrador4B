import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { DashboardHome, DashboardProfile } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import RecuperarPassword from "./pages/auth/RecuperarPassword";
import Pacientes from "./pages/pacientes/Pacientes";
import Citas from "./pages/citas/Citas";
import Examenes from "./pages/examenes/examenes";
import HistoriaClinica from "./pages/historia/HistoriaClinica";
import Recetas from "./pages/recetas/Recetas";
import Inventario from "./pages/inventario/Inventario";
import Compras from "./pages/compras/Compras";
import Facturacion from "./pages/facturacion/Facturacion";
import Caja from "./pages/caja/Caja";
import Cartera from "./pages/cartera/Cartera";
import Usuarios from "./pages/usuarios/Usuarios";
import RolesPermisos from "./pages/roles/RolesPermisos";

const permit = (roles, element) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

export default function App() {
    return <AuthProvider><BrowserRouter><Routes>
        <Route path="/login" element={<Login/>}/>
        <Route path="/recuperar" element={<RecuperarPassword/>}/>
        <Route path="/dashboard" element={<ProtectedRoute><Layout/></ProtectedRoute>}>
            <Route index element={<DashboardHome/>}/>
            <Route path="perfil" element={<DashboardProfile/>}/>
            <Route path="pacientes" element={permit(["Administrador","Optometra","Cajero","Vendedor"],<Pacientes/>)}/>
            <Route path="citas" element={permit(["Administrador","Optometra","Cajero","Vendedor"],<Citas/>)}/>
            <Route path="examenes" element={permit(["Administrador","Optometra"],<Examenes/>)}/>
            <Route path="historias" element={permit(["Administrador","Optometra"],<HistoriaClinica/>)}/>
            <Route path="recetas" element={permit(["Administrador","Optometra","Vendedor"],<Recetas/>)}/>
            <Route path="inventario" element={permit(["Administrador","Cajero","Vendedor"],<Inventario/>)}/>
            <Route path="compras" element={permit(["Administrador"],<Compras/>)}/>
            <Route path="facturacion" element={permit(["Administrador","Cajero"],<Facturacion/>)}/>
            <Route path="caja" element={permit(["Administrador","Cajero"],<Caja/>)}/>
            <Route path="cartera" element={permit(["Administrador","Cajero"],<Cartera/>)}/>
            <Route path="usuarios" element={permit(["Administrador"],<Usuarios/>)}/>
            <Route path="roles-permisos" element={permit(["Administrador"],<RolesPermisos/>)}/>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace/>}/>
    </Routes></BrowserRouter></AuthProvider>;
}
