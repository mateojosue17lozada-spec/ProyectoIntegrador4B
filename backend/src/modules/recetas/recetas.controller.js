const service=require("./recetas.service");


exports.crear=async(req,res)=>{


res.json(

await service.crear(req.body)

);


};