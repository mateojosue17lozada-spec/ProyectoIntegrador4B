import {useNavigate} from "react-router-dom";


export default function Login(){


const navigate=useNavigate();


return(

<div>


<h1>
Login Sistema Óptica
</h1>


<input placeholder="Usuario"/>


<input placeholder="Contraseña"
type="password"
/>


<button
onClick={()=>navigate("/dashboard")}
>

Ingresar

</button>


</div>

)

}