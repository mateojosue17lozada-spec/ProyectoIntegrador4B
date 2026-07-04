import {Outlet} from "react-router-dom";

import Menu from "../components/Menu";


export default function DashboardLayout(){

return(

<div>


<Menu/>


<main>

<Outlet/>

</main>


</div>


)

}