import {Link} from "react-router-dom";


export default function Menu(){

return(

<nav>


<h2>Óptica Sistema</h2>


<Link to="/dashboard">
Dashboard
</Link>


<Link to="/pacientes">
Pacientes
</Link>


<Link to="/citas">
Citas
</Link>


<Link to="/historia">
Historia Clínica
</Link>


<Link to="/inventario">
Inventario
</Link>


<Link to="/facturacion">
Facturación
</Link>


<Link to="/caja">
Caja
</Link>


<Link to="/cartera">
Cartera
</Link>


<button>
Cerrar sesión
</button>


</nav>

)

}