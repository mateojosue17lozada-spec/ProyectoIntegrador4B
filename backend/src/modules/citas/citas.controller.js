const service = require("./citas.service");
const registrarAuditoria = require("../../utils/audit");
const responderError = require("../../utils/dbError");

exports.obtener = async (req, res) => {
    try {
        const citas = await service.obtener(req.query);
        res.json(citas);
    } catch (error) {
        responderError(res,error,"Error al obtener citas");
    }
};

exports.crear = async (req, res) => {
    try {
        const cita = await service.crear({...req.body,id_usuario:req.usuario.id});

        await registrarAuditoria({
            idUsuario: req.usuario?.id,
            accion: "CITA_CREADA",
            tabla: "citas",
            registroId: cita?.id_cita,
            detalle: cita,
            req
        });

        res.json({ mensaje: "Cita creada", cita });
    } catch (error) {
        responderError(res,error,"Error al crear cita");
    }
};

exports.eliminar = async(req,res)=>{try{const cita=await service.eliminar(req.params.id);await registrarAuditoria({idUsuario:req.usuario.id,accion:"CITA_ELIMINADA",tabla:"citas",registroId:cita.id_cita,req});res.json({mensaje:"Cita eliminada",cita})}catch(error){responderError(res,error,"Error al eliminar cita")}};
