const service=require("./compras.service");


exports.crear=async(req,res)=>{


res.json(

await service.crear(req.body)

);


};