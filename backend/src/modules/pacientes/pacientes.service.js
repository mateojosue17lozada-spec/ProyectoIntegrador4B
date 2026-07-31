const pool = require("../../config/database");

const campos = [
    "nombre", "apellido", "cedula", "telefono", "correo", "direccion",
    "fecha_nacimiento", "lugar_nacimiento", "genero", "ocupacion",
    "procedencia", "uso_lentes", "ultimo_control", "foto_data", "forma_rostro"
];

const validarImagen = (value) => {
    if (!value) return;
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || value.length > 2200000) {
        throw Object.assign(new Error("La foto debe ser JPG, PNG o WebP y pesar menos de 1.5 MB"), { status: 400 });
    }
};

const validar = (data) => {
    validarImagen(data.foto_data);
    for (const campo of ["nombre", "apellido", "cedula", "telefono", "direccion", "fecha_nacimiento", "genero", "ocupacion", "lugar_nacimiento"]) {
        if (!String(data[campo] || "").trim()) {
            throw Object.assign(new Error(`${campo} es obligatorio`), { status: 400 });
        }
    }
    if (data.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) {
        throw Object.assign(new Error("Correo inválido"), { status: 400 });
    }
    const cedula=String(data.cedula||"").replace(/\D/g,"");
    if(cedula.length!==10){throw Object.assign(new Error("La cédula ecuatoriana debe tener 10 dígitos"),{status:400})}
    const provincia=Number(cedula.slice(0,2)),tercero=Number(cedula[2]);let suma=0;
    for(let i=0;i<9;i++){let valor=Number(cedula[i])*(i%2===0?2:1);if(valor>9)valor-=9;suma+=valor}
    if(provincia<1||provincia>24||tercero>5||(10-(suma%10))%10!==Number(cedula[9]))throw Object.assign(new Error("La cédula ecuatoriana no es válida"),{status:400});
};

exports.obtener = async (f={}) => {
    const values=[],where=[];
    if(f.activo!=="todos"){values.push(f.activo==="false"?false:true);where.push(`activo=$${values.length}`)}
    if(f.q){values.push(`%${String(f.q).trim()}%`);where.push(`(nombre ILIKE $${values.length} OR apellido ILIKE $${values.length} OR cedula ILIKE $${values.length} OR telefono ILIKE $${values.length})`)}
    const clause=where.length?`WHERE ${where.join(" AND ")}`:"";
    if(f.paginado!=="true") return (await pool.query(`SELECT * FROM pacientes ${clause} ORDER BY apellido,nombre LIMIT 500`,values)).rows;
    const page=Math.max(1,Number(f.page)||1),pageSize=Math.min(50,Math.max(5,Number(f.pageSize)||15));
    const count=await pool.query(`SELECT COUNT(*)::int total FROM pacientes ${clause}`,values);
    values.push(pageSize,(page-1)*pageSize);
    const rows=await pool.query(`SELECT * FROM pacientes ${clause} ORDER BY apellido,nombre LIMIT $${values.length-1} OFFSET $${values.length}`,values);
    return { rows:rows.rows, total:count.rows[0].total, page, pageSize, pages:Math.max(1,Math.ceil(count.rows[0].total/pageSize)) };
};

exports.crear = async (data) => {
    validar(data);
    const values = campos.map((campo) => {
        if (campo === "uso_lentes") return data[campo] === true || data[campo] === "true";
        return typeof data[campo] === "string" ? data[campo].trim() || null : data[campo] ?? null;
    });
    const result = await pool.query(
        `INSERT INTO pacientes(${campos.join(",")})
         VALUES(${campos.map((_, index) => `$${index + 1}`).join(",")}) RETURNING *`, values
    );
    return result.rows[0];
};

exports.actualizar = async (id, data) => {
    validar(data);
    const values = campos.map((campo) => {
        if (campo === "uso_lentes") return data[campo] === true || data[campo] === "true";
        return typeof data[campo] === "string" ? data[campo].trim() || null : data[campo] ?? null;
    });
    const set = campos.map((campo, index) => `${campo}=$${index + 1}`).join(",");
    const result = await pool.query(
        `UPDATE pacientes SET ${set} WHERE id_paciente=$${campos.length + 1} AND activo=TRUE RETURNING *`,
        [...values, id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Paciente no encontrado"), { status: 404 });
    return result.rows[0];
};

exports.eliminar = async (id) => {
    const result = await pool.query(
        "UPDATE pacientes SET activo=FALSE WHERE id_paciente=$1 AND activo=TRUE RETURNING *", [id]
    );
    if (!result.rows[0]) throw Object.assign(new Error("Paciente no encontrado"), { status: 404 });
    return result.rows[0];
};
