const express = require("express");
const router = express.Router();

const pool = require("../config/database");



router.get("/prueba", async (req,res)=>{

    try {

        const resultado = await pool.query(
            "SELECT * FROM tabla_prueba"
        );


        res.json(resultado.rows);


    } catch(error){

        console.log(error);

        res.status(500).json({
            mensaje:"Error en la consulta"
        });

    }

});


module.exports = router;