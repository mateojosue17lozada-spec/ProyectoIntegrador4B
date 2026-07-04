const service = require("./usuarios.service");


exports.obtener = async(req,res)=>{


const datos = await service.obtener();


res.json(datos);


};



exports.crear = async(req,res)=>{


const datos = await service.crear(req.body);


res.json(datos);


};