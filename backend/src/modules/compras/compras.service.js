const pool=require("../../config/database");const registrarAuditoria=require("../../utils/audit");
exports.proveedores=async()=>(await pool.query("SELECT * FROM proveedores ORDER BY nombre")).rows;
exports.crearProveedor=async(data)=>(await pool.query(`INSERT INTO proveedores(nombre,ruc,telefono,correo,direccion,condiciones_credito,dias_credito)
 VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[data.nombre,data.ruc||null,data.telefono||null,data.correo||null,data.direccion||null,data.condiciones_credito||null,Number(data.dias_credito||0)])).rows[0];
exports.actualizarProveedor=async(id,data)=>{const r=await pool.query(`UPDATE proveedores SET nombre=$1,ruc=$2,telefono=$3,correo=$4,direccion=$5,condiciones_credito=$6,dias_credito=$7 WHERE id_proveedor=$8 RETURNING *`,[data.nombre,data.ruc||null,data.telefono||null,data.correo||null,data.direccion||null,data.condiciones_credito||null,Number(data.dias_credito||0),id]);if(!r.rows[0])throw Object.assign(new Error("Proveedor no encontrado"),{status:404});return r.rows[0]};
exports.eliminarProveedor=async(id)=>{const r=await pool.query("DELETE FROM proveedores WHERE id_proveedor=$1 RETURNING *",[id]);if(!r.rows[0])throw Object.assign(new Error("Proveedor no encontrado"),{status:404});return r.rows[0]};
exports.listar=async()=>(await pool.query(`SELECT o.*,p.nombre AS proveedor FROM ordenes_compra o JOIN proveedores p USING(id_proveedor) ORDER BY o.fecha_orden DESC`)).rows;
exports.crear=async(data,usuario,req)=>{const client=await pool.connect();try{await client.query("BEGIN");
 const detalles=data.detalles||[];if(!detalles.length)throw new Error("La orden requiere productos");
 const total=detalles.reduce((s,d)=>s+Number(d.cantidad)*Number(d.costo_unitario),0);
 const o=await client.query("INSERT INTO ordenes_compra(id_proveedor,id_usuario,total) VALUES($1,$2,$3) RETURNING *",[data.id_proveedor,usuario.id,total]);
 for(const d of detalles)await client.query(`INSERT INTO orden_compra_detalle(id_orden_compra,id_producto,descripcion,cantidad,costo_unitario)
 VALUES($1,$2,$3,$4,$5)`,[o.rows[0].id_orden_compra,d.id_producto||null,d.descripcion,Number(d.cantidad),Number(d.costo_unitario)]);
 await client.query("COMMIT");await registrarAuditoria({idUsuario:usuario.id,accion:"ORDEN_COMPRA_CREADA",tabla:"ordenes_compra",registroId:o.rows[0].id_orden_compra,req});return o.rows[0];
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}};
exports.cancelar=async(id)=>{const r=await pool.query("UPDATE ordenes_compra SET estado='Cancelada' WHERE id_orden_compra=$1 AND estado IN ('Pendiente','Aprobada') RETURNING *",[id]);if(!r.rows[0])throw Object.assign(new Error("Orden no disponible para cancelar"),{status:409});return r.rows[0]};
exports.obtener=async(id)=>{const o=await pool.query("SELECT * FROM ordenes_compra WHERE id_orden_compra=$1",[id]);if(!o.rows[0])throw new Error("Orden no encontrada");
 o.rows[0].detalles=(await pool.query("SELECT * FROM orden_compra_detalle WHERE id_orden_compra=$1",[id])).rows;return o.rows[0]};
exports.recibir=async(id,data,usuario,req)=>{const client=await pool.connect();try{await client.query("BEGIN");
 const orden=await client.query("SELECT * FROM ordenes_compra WHERE id_orden_compra=$1 FOR UPDATE",[id]);if(!orden.rows[0])throw new Error("Orden no encontrada");if(orden.rows[0].estado==="Recibida")throw new Error("La orden ya fue recibida");
 const detalles=await client.query("SELECT * FROM orden_compra_detalle WHERE id_orden_compra=$1",[id]);
 const rec=await client.query("INSERT INTO recepciones_compra(id_orden_compra,factura_proveedor,id_usuario) VALUES($1,$2,$3) RETURNING *",[id,data.factura_proveedor||null,usuario.id]);
 for(const d of detalles.rows){if(!d.id_producto)continue;await client.query("UPDATE productos SET stock=stock+$1,costo=$2 WHERE id_producto=$3",[d.cantidad,d.costo_unitario,d.id_producto]);await client.query("INSERT INTO recepcion_compra_detalle(id_recepcion,id_producto,cantidad,costo_unitario) VALUES($1,$2,$3,$4)",[rec.rows[0].id_recepcion,d.id_producto,d.cantidad,d.costo_unitario])}
 await client.query("UPDATE ordenes_compra SET estado='Recibida' WHERE id_orden_compra=$1",[id]);
 if(Number(orden.rows[0].total)>0)await client.query(`INSERT INTO cuentas_por_pagar(id_proveedor,id_orden_compra,saldo,fecha_vencimiento)
 VALUES($1,$2,$3,CURRENT_DATE+$4::integer)`,[orden.rows[0].id_proveedor,id,orden.rows[0].total,Number(data.dias_credito||0)]);
 await client.query("COMMIT");await registrarAuditoria({idUsuario:usuario.id,accion:"COMPRA_RECIBIDA",tabla:"recepciones_compra",registroId:rec.rows[0].id_recepcion,req});return rec.rows[0];
 }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}};
