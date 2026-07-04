const service=require("./inventario.service");


exports.listar=async(req,res)=>{


res.json(

await service.listar()

);


};