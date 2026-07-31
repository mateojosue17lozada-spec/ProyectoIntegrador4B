const service = require("./pacientes.service");
const registrarAuditoria = require("../../utils/audit");
const responderError = require("../../utils/dbError");

exports.obtener = async (req,res) => {
    try { res.json(await service.obtener(req.query)); }
    catch (error) { responderError(res,error,"Error al obtener pacientes"); }
};
exports.crear = async (req,res) => {
    try {
        const paciente=await service.crear(req.body);
        await registrarAuditoria({idUsuario:req.usuario.id,accion:"PACIENTE_CREADO",tabla:"pacientes",registroId:paciente.id_paciente,req});
        res.status(201).json({mensaje:"Paciente creado",paciente});
    } catch(error) { responderError(res,error,"Error al crear paciente"); }
};
exports.actualizar = async (req,res) => {
    try {
        const paciente=await service.actualizar(req.params.id,req.body);
        await registrarAuditoria({idUsuario:req.usuario.id,accion:"PACIENTE_ACTUALIZADO",tabla:"pacientes",registroId:paciente.id_paciente,req});
        res.json({mensaje:"Paciente actualizado",paciente});
    } catch(error) { responderError(res,error,"Error al actualizar paciente"); }
};
exports.eliminar = async (req,res) => {
    try {
        const paciente=await service.eliminar(req.params.id);
        await registrarAuditoria({idUsuario:req.usuario.id,accion:"PACIENTE_ELIMINADO",tabla:"pacientes",registroId:paciente.id_paciente,req});
        res.json({mensaje:"Paciente eliminado",paciente});
    } catch(error) { responderError(res,error,"Error al eliminar paciente"); }
};
