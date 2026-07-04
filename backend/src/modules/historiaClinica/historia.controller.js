const service=require("./historia.service");


exports.crear=async(req,res)=>{


res.json(

await service.crear(req.body)

);


};



exports.obtener=async(req,res)=>{


res.json(

await service.obtener()

);


};