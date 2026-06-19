const express = require("express");
const cors = require("cors");

const pruebaRoutes = require("./routes/prueba.routes");


const app = express();


app.use(cors());

app.use(express.json());


app.use("/api", pruebaRoutes);



app.get("/",(req,res)=>{

    res.json({
        mensaje:"API funcionando"
    });

});


app.listen(3000,()=>{

    console.log("Servidor en puerto 3000");

});