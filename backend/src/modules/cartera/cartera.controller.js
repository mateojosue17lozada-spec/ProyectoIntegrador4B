const service=require("./cartera.service");


exports.obtener=async(req,res)=>{


res.json(

await service.obtener()

);


};