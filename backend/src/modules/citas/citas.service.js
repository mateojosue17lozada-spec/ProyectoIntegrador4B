// backend/src/modules/citas/citas.service.js


const pool = require("../../config/database");





exports.obtener = async()=>{


const result = await pool.query(


`

SELECT


c.id_cita,

c.id_paciente,

c.id_usuario,


p.nombre AS paciente_nombre,


p.apellido AS paciente_apellido,


c.fecha_cita,


c.hora_cita,


c.motivo,


c.estado
,
c.observacion,
c.pago_previo


FROM citas c


INNER JOIN pacientes p

ON c.id_paciente = p.id_paciente



ORDER BY c.id_cita DESC


`

);



return result.rows;



};







exports.crear = async(data)=>{

if(!data.id_paciente) throw Object.assign(new Error("El paciente es obligatorio"),{status:400});
if(!data.id_usuario) throw Object.assign(new Error("El usuario es obligatorio"),{status:400});
if(!data.fecha_cita || !data.hora_cita) throw Object.assign(new Error("La fecha y hora son obligatorias"),{status:400});


const {


id_paciente,

id_usuario,

fecha_cita,

hora_cita,

motivo


}=data;




const result = await pool.query(


`

INSERT INTO citas

(

id_paciente,

id_usuario,

fecha_cita,

hora_cita,

motivo

)


VALUES

($1,$2,$3,$4,$5)


RETURNING *


`,


[


id_paciente,

id_usuario,

fecha_cita,

hora_cita,

motivo


]


);



return result.rows[0];



};

exports.eliminar = async (id) => {
    const result=await pool.query("DELETE FROM citas WHERE id_cita=$1 RETURNING *",[id]);
    if(!result.rows[0]) throw Object.assign(new Error("Cita no encontrada"),{status:404});
    return result.rows[0];
};

exports.actualizarEstado = async (id, data) => {
    const result = await pool.query(
        `UPDATE citas SET estado = COALESCE($1,estado), observacion = COALESCE($2,observacion)
         WHERE id_cita = $3 RETURNING *`,
        [data.estado || null, data.observacion || null, id]
    );
    if (!result.rows[0]) throw new Error("Cita no encontrada");
    return result.rows[0];
};

exports.registrarPagoPrevio = async (id, data, usuario) => {
    if(!Number.isFinite(Number(data.monto)) || Number(data.monto)<=0) throw Object.assign(new Error("El monto debe ser mayor a cero"),{status:400});
    if(!data.forma_pago) throw Object.assign(new Error("La forma de pago es obligatoria"),{status:400});
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const cita = await client.query("SELECT * FROM citas WHERE id_cita=$1 FOR UPDATE", [id]);
        if (!cita.rows[0]) throw new Error("Cita no encontrada");
        const pago = await client.query(
            `INSERT INTO pagos_previos(id_cita,id_usuario,monto,forma_pago,referencia)
             VALUES($1,$2,$3,$4,$5) RETURNING *`,
            [id, usuario.id, Number(data.monto), data.forma_pago, data.referencia || null]
        );
        await client.query("UPDATE citas SET pago_previo=TRUE,estado='Pagada' WHERE id_cita=$1", [id]);
        await client.query("COMMIT");
        return pago.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
};
