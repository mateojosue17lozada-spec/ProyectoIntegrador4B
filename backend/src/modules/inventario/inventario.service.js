const pool=require("../../config/database");
const registrarAuditoria=require("../../utils/audit");
const imagen=(value)=>{if(!value)return null;if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)||value.length>2200000)throw Object.assign(new Error("Imagen invalida o mayor a 1.5 MB"),{status:400});return value};

exports.listar=async(filtros={})=>{
 const values=[]; const where=[];
 if(filtros.activo!=="todos")where.push(`p.activo=${filtros.activo==="false"?"FALSE":"TRUE"}`);
 if(filtros.codigo){values.push(filtros.codigo);where.push(`(p.codigo_barra=$${values.length} OR p.sku=$${values.length})`)}
 if(filtros.q){values.push(`%${String(filtros.q).trim()}%`);where.push(`(p.nombre ILIKE $${values.length} OR p.codigo_barra ILIKE $${values.length} OR p.sku ILIKE $${values.length})`)}
 if(filtros.stock_bajo==="true")where.push("p.stock <= p.stock_minimo");
 const r=await pool.query(`SELECT p.*,c.nombre AS categoria,
   (p.stock<=p.stock_minimo) AS stock_bajo,
   CASE WHEN p.costo>0 THEN ROUND(((p.precio-p.costo)/p.costo)*100,2) ELSE NULL END AS margen_porcentaje FROM productos p
   LEFT JOIN categorias_producto c USING(id_categoria)
   ${where.length?`WHERE ${where.join(" AND ")}`:""} ORDER BY p.nombre`,values);
 return r.rows;
};
exports.categorias=async()=>(await pool.query("SELECT * FROM categorias_producto ORDER BY nombre")).rows;
exports.crearCategoria=async(data)=>(await pool.query("INSERT INTO categorias_producto(nombre) VALUES($1) RETURNING *",[data.nombre])).rows[0];
exports.actualizarCategoria=async(id,data)=>{const r=await pool.query("UPDATE categorias_producto SET nombre=$1 WHERE id_categoria=$2 RETURNING *",[data.nombre,id]);if(!r.rows[0])throw Object.assign(new Error("Categoria no encontrada"),{status:404});return r.rows[0]};
exports.eliminarCategoria=async(id)=>{const r=await pool.query("DELETE FROM categorias_producto WHERE id_categoria=$1 RETURNING *",[id]);if(!r.rows[0])throw Object.assign(new Error("Categoria no encontrada"),{status:404});return r.rows[0]};
exports.crear=async(data,usuario,req)=>{
 const r=await pool.query(`INSERT INTO productos(id_categoria,codigo_barra,nombre,descripcion,material,
 esfera,cilindro,eje,stock,stock_minimo,costo,precio,sku,tipo_lente,filtro,imagen_data,forma_montura,color_montura)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
 [data.id_categoria||null,data.codigo_barra||null,data.nombre,data.descripcion||null,data.material||null,
 data.esfera||null,data.cilindro||null,data.eje||null,Number(data.stock||0),Number(data.stock_minimo||0),Number(data.costo||0),Number(data.precio||0),data.sku||null,data.tipo_lente||null,data.filtro||null,imagen(data.imagen_data),data.forma_montura||null,data.color_montura||null]);
 await registrarAuditoria({idUsuario:usuario.id,accion:"PRODUCTO_CREADO",tabla:"productos",registroId:r.rows[0].id_producto,req});
 return r.rows[0];
};
exports.actualizar=async(id,data,usuario,req)=>{
 const r=await pool.query(`UPDATE productos SET id_categoria=$1,codigo_barra=$2,nombre=$3,
 descripcion=$4,material=$5,esfera=$6,cilindro=$7,eje=$8,stock_minimo=$9,costo=$10,precio=$11,
 activo=COALESCE($12,activo),sku=$13,tipo_lente=$14,filtro=$15,imagen_data=COALESCE($16,imagen_data),forma_montura=$17,color_montura=$18 WHERE id_producto=$19 RETURNING *`,
 [data.id_categoria||null,data.codigo_barra||null,data.nombre,data.descripcion||null,data.material||null,
 data.esfera||null,data.cilindro||null,data.eje||null,Number(data.stock_minimo||0),Number(data.costo||0),Number(data.precio||0),data.activo,data.sku||null,data.tipo_lente||null,data.filtro||null,imagen(data.imagen_data),data.forma_montura||null,data.color_montura||null,id]);
 if(!r.rows[0])throw new Error("Producto no encontrado");
 await registrarAuditoria({idUsuario:usuario.id,accion:"PRODUCTO_ACTUALIZADO",tabla:"productos",registroId:Number(id),req});return r.rows[0];
};
exports.ajustar=async(data,usuario,req)=>{
 const client=await pool.connect();try{await client.query("BEGIN");
  const p=await client.query("SELECT stock FROM productos WHERE id_producto=$1 FOR UPDATE",[data.id_producto]);
  if(!p.rows[0])throw new Error("Producto no encontrado");
  const cantidad=Number(data.cantidad);const nuevo=Number(p.rows[0].stock)+cantidad;
  if(nuevo<0)throw new Error("El ajuste deja el stock en negativo");
  await client.query("UPDATE productos SET stock=$1 WHERE id_producto=$2",[nuevo,data.id_producto]);
  const a=await client.query(`INSERT INTO ajustes_inventario(id_producto,id_usuario,tipo,cantidad,motivo)
   VALUES($1,$2,$3,$4,$5) RETURNING *`,[data.id_producto,usuario.id,data.tipo,cantidad,data.motivo||null]);
  await client.query("COMMIT");
  await registrarAuditoria({idUsuario:usuario.id,accion:"INVENTARIO_AJUSTADO",tabla:"ajustes_inventario",registroId:a.rows[0].id_ajuste,detalle:{cantidad},req});return a.rows[0];
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
};
exports.ajustes=async()=>(await pool.query(`SELECT a.*,p.nombre AS producto FROM ajustes_inventario a
 JOIN productos p USING(id_producto) ORDER BY a.creado_en DESC`)).rows;
exports.desactivar=async(id,usuario,req)=>{const r=await pool.query("UPDATE productos SET activo=FALSE WHERE id_producto=$1 RETURNING *",[id]);if(!r.rows[0])throw Object.assign(new Error("Producto no encontrado"),{status:404});await registrarAuditoria({idUsuario:usuario.id,accion:"PRODUCTO_DESACTIVADO",tabla:"productos",registroId:Number(id),req});return r.rows[0]};
