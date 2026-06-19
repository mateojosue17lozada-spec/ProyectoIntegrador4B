const pool = require("./config/database");


pool.query("SELECT * FROM tabla_prueba")
.then(resultado=>{

console.log(resultado.rows);

})
.catch(error=>{

console.log(error);

});