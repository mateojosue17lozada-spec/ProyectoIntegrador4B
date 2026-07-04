// backend/src/modules/examenes/examenes.service.js


const pool = require("../../config/database");




// OBTENER EXAMENES

exports.obtener = async()=>{


const result = await pool.query(

`

SELECT


e.id_examen,


p.nombre AS paciente_nombre,

p.apellido AS paciente_apellido,


e.ojo_derecho,


e.ojo_izquierdo,


e.diagnostico,


e.observacion,


e.fecha_examen


FROM examen_visual e



INNER JOIN pacientes p


ON e.id_paciente = p.id_paciente



ORDER BY e.id_examen DESC


`

);



return result.rows;


};







// CREAR EXAMEN


exports.crear = async(data)=>{

if(!data.id_paciente || !data.id_cita) throw Object.assign(new Error("Paciente y cita son obligatorios"),{status:400});


const {


id_paciente,

id_cita,

ojo_derecho,

ojo_izquierdo,

diagnostico,

observacion


}=data;





const result = await pool.query(


`

INSERT INTO examen_visual

(

id_paciente,

id_cita,

ojo_derecho,

ojo_izquierdo,

diagnostico,

observacion

)


VALUES

($1,$2,$3,$4,$5,$6)



RETURNING *


`,

[

id_paciente,

id_cita,

ojo_derecho,

ojo_izquierdo,

diagnostico,

observacion


]

);



return result.rows[0];


};






// ACTUALIZAR


exports.actualizar = async(id,data)=>{


const {


ojo_derecho,

ojo_izquierdo,

diagnostico,

observacion


}=data;




const result = await pool.query(


`

UPDATE examen_visual


SET


ojo_derecho=$1,


ojo_izquierdo=$2,


diagnostico=$3,


observacion=$4



WHERE id_examen=$5



RETURNING *



`,

[

ojo_derecho,

ojo_izquierdo,

diagnostico,

observacion,

id


]


);



return result.rows[0];


};







// ELIMINAR


exports.eliminar = async(id)=>{


const result = await pool.query(


`

DELETE FROM examen_visual


WHERE id_examen=$1



RETURNING *


`,

[id]


);



return result.rows[0];


};
