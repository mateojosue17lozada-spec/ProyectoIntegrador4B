const service=require("./caja.service");


exports.estado=async(req,res)=>{


res.json(

await service.estado()

);


};