const pool = require("../../config/database");
const registrarAuditoria = require("../../utils/audit");

// Tope de imagenes de galeria por producto (ademas de la principal).
const MAX_IMAGENES_PRODUCTO = 8;

// Normaliza el array `imagenes` del payload: cada elemento puede venir como
// string base64 o como { ruta }. Valida formato y tamano con el mismo helper
// que la imagen principal, y recorta al maximo permitido.
const galeriaValida = (imagenes) => {
    if (!Array.isArray(imagenes)) return null; // ausente -> no se toca la galeria
    return imagenes
        .slice(0, MAX_IMAGENES_PRODUCTO)
        .map((item) => imagen(item?.ruta ?? item))
        .filter(Boolean);
};

// Helper para validar imagen base64 (sigue igual)
const imagen = (value) => {
    if (!value) return null;
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || value.length > 2200000) {
        throw Object.assign(new Error("Imagen invalida o mayor a 1.5 MB"), { status: 400 });
    }
    return value;
};

// La columna prueba_virtual_data la agrega la migracion
// 20260906120000_pedido_prueba_virtual.sql. Si el codigo se despliega antes que
// la migracion, el pedido debe seguir generandose sin la imagen en lugar de
// fallar: se comprueba una sola vez y se cachea.
let columnaPruebaVirtual = null;
const soportaPruebaVirtual = async () => {
    if (columnaPruebaVirtual === null) {
        const r = await pool.query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_name = 'pedido_detalle' AND column_name = 'prueba_virtual_data'`
        );
        columnaPruebaVirtual = r.rowCount > 0;
    }
    return columnaPruebaVirtual;
};

// ==================== LISTAR PRODUCTOS (ADMIN) ====================
exports.listar = async (filtros = {}) => {
    const values = [];
    const where = [];
    if (filtros.activo !== "todos") where.push(`p.activo = ${filtros.activo === "false" ? "FALSE" : "TRUE"}`);
    if (filtros.codigo) {
        values.push(filtros.codigo);
        where.push(`(p.codigo_barra = $${values.length} OR p.sku = $${values.length})`);
    }
    if (filtros.q) {
        values.push(`%${String(filtros.q).trim()}%`);
        where.push(`(p.nombre ILIKE $${values.length} OR p.codigo_barra ILIKE $${values.length} OR p.sku ILIKE $${values.length})`);
    }
    if (filtros.stock_bajo === "true") where.push("p.stock <= p.stock_minimo");

    const sql = `
        SELECT p.*, c.nombre AS categoria,
            (p.stock <= p.stock_minimo) AS stock_bajo,
            (SELECT COUNT(*)::int FROM producto_imagenes pi WHERE pi.id_producto = p.id_producto) AS cantidad_imagenes,
            CASE WHEN p.costo > 0 THEN ROUND(((p.precio - p.costo) / p.costo) * 100, 2) ELSE NULL END AS margen_porcentaje
        FROM productos p
        LEFT JOIN categorias_producto c USING(id_categoria)
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY p.nombre
    `;
    const result = await pool.query(sql, values);
    return result.rows;
};

// ==================== CATÁLOGO PÚBLICO (PACIENTE) ====================
// Función para el catálogo público (solo productos activos) - SIN producto_imagenes
exports.listarCatalogo = async (filtros = {}) => {
  const values = [];
  const where = ["p.activo = TRUE"];

  if (filtros.q) {
    values.push(`%${String(filtros.q).trim()}%`);
    where.push(`(p.nombre ILIKE $${values.length} OR p.codigo_barra ILIKE $${values.length} OR p.sku ILIKE $${values.length})`);
  }

  if (filtros.categoria) {
    values.push(filtros.categoria);
    where.push(`p.id_categoria = $${values.length}`);
  }

  // Orden por nombre o precio
  const orderBy = filtros.orden === 'precio_asc' ? 'p.precio ASC' 
    : filtros.orden === 'precio_desc' ? 'p.precio DESC' 
    : 'p.nombre ASC';

  const sql = `
    SELECT 
      p.id_producto,
      p.nombre,
      p.descripcion,
      p.precio,
      p.imagen_data,
      p.stock,
      p.stock_minimo,
      p.codigo_barra,
      p.sku,
      p.tipo_lente,
      p.material,
      p.esfera,
      p.cilindro,
      p.eje,
      p.forma_montura,
      p.color_montura,
      (SELECT COUNT(*)::int FROM producto_imagenes pi WHERE pi.id_producto = p.id_producto) AS cantidad_imagenes,
      c.nombre AS categoria
    FROM productos p
    LEFT JOIN categorias_producto c ON p.id_categoria = c.id_categoria
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy}
  `;

  const result = await pool.query(sql, values);
  return result.rows;
};

// ==================== DETALLE DE PRODUCTO (PACIENTE) ====================
exports.detalleCatalogo = async (id) => {
    const sql = `
        SELECT 
            p.id_producto, 
            p.nombre, 
            p.descripcion, 
            p.precio, 
            p.stock, 
            p.stock_minimo,
            p.codigo_barra, 
            p.sku, 
            p.tipo_lente, 
            p.material, 
            p.esfera, 
            p.cilindro, 
            p.eje,
            p.forma_montura,
            p.color_montura,
            p.imagen_data,
            -- Galeria de imagenes adicionales, ordenada. Vacio ('[]') si el
            -- producto solo tiene la imagen principal o ninguna: la
            -- compatibilidad hacia atras la resuelve el frontend usando
            -- imagen_data como respaldo.
            COALESCE((
                SELECT json_agg(json_build_object('ruta', pi.ruta, 'orden', pi.orden) ORDER BY pi.orden)
                FROM producto_imagenes pi WHERE pi.id_producto = p.id_producto
            ), '[]') AS imagenes,
            c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias_producto c ON p.id_categoria = c.id_categoria
        WHERE p.id_producto = $1 AND p.activo = TRUE
    `;
    const result = await pool.query(sql, [id]);
    if (!result.rows[0]) {
        throw Object.assign(new Error("Producto no encontrado o no disponible"), { status: 404 });
    }
    return result.rows[0];
};

// ==================== CATEGORÍAS (ADMIN) ====================
exports.categorias = async () => (await pool.query("SELECT * FROM categorias_producto ORDER BY nombre")).rows;
exports.crearCategoria = async (data) => (await pool.query("INSERT INTO categorias_producto(nombre) VALUES($1) RETURNING *", [data.nombre])).rows[0];
exports.actualizarCategoria = async (id, data) => {
    const r = await pool.query("UPDATE categorias_producto SET nombre=$1 WHERE id_categoria=$2 RETURNING *", [data.nombre, id]);
    if (!r.rows[0]) throw Object.assign(new Error("Categoria no encontrada"), { status: 404 });
    return r.rows[0];
};
exports.eliminarCategoria = async (id) => {
    const r = await pool.query("DELETE FROM categorias_producto WHERE id_categoria=$1 RETURNING *", [id]);
    if (!r.rows[0]) throw Object.assign(new Error("Categoria no encontrada"), { status: 404 });
    return r.rows[0];
};

// ==================== CRUD PRODUCTOS (ADMIN) ====================
exports.crear = async (data, usuario, req) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const r = await client.query(
            `INSERT INTO productos(id_categoria, codigo_barra, nombre, descripcion, material,
                esfera, cilindro, eje, stock, stock_minimo, costo, precio, sku, tipo_lente, filtro, imagen_data, forma_montura, color_montura)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *`,
            [
                data.id_categoria || null, data.codigo_barra || null, data.nombre, data.descripcion || null,
                data.material || null, data.esfera || null, data.cilindro || null, data.eje || null,
                Number(data.stock || 0), Number(data.stock_minimo || 0), Number(data.costo || 0),
                Number(data.precio || 0), data.sku || null, data.tipo_lente || null, data.filtro || null,
                imagen(data.imagen_data), data.forma_montura || null, data.color_montura || null
            ]
        );
        const productoId = r.rows[0].id_producto;

        // Galeria de imagenes adicionales (validadas y con tope). El orden del
        // array es el orden del carrusel.
        const galeria = galeriaValida(data.imagenes);
        if (galeria) {
            for (let i = 0; i < galeria.length; i++) {
                await client.query(
                    `INSERT INTO producto_imagenes (id_producto, ruta, orden) VALUES ($1, $2, $3)`,
                    [productoId, galeria[i], i]
                );
            }
        }

        await client.query("COMMIT");
        await registrarAuditoria({ idUsuario: usuario.id, accion: "PRODUCTO_CREADO", tabla: "productos", registroId: productoId, req });
        return r.rows[0];
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

exports.actualizar = async (id, data, usuario, req) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const r = await client.query(
            `UPDATE productos SET 
                id_categoria=$1, codigo_barra=$2, nombre=$3, descripcion=$4,
                material=$5, esfera=$6, cilindro=$7, eje=$8, stock_minimo=$9, costo=$10, precio=$11,
                activo=COALESCE($12, activo), sku=$13, tipo_lente=$14, filtro=$15,
                imagen_data=COALESCE($16, imagen_data), forma_montura=$17, color_montura=$18
            WHERE id_producto=$19 RETURNING *`,
            [
                data.id_categoria || null, data.codigo_barra || null, data.nombre, data.descripcion || null,
                data.material || null, data.esfera || null, data.cilindro || null, data.eje || null,
                Number(data.stock_minimo || 0), Number(data.costo || 0), Number(data.precio || 0),
                data.activo, data.sku || null, data.tipo_lente || null, data.filtro || null,
                imagen(data.imagen_data), data.forma_montura || null, data.color_montura || null, id
            ]
        );
        if (!r.rows[0]) throw new Error("Producto no encontrado");

        // Solo si el payload trae `imagenes` (array) se reemplaza la galeria.
        // Si el campo viene ausente, las imagenes existentes se conservan: asi
        // editar otros campos del producto no borra la galeria sin querer.
        const galeria = galeriaValida(data.imagenes);
        if (galeria) {
            await client.query("DELETE FROM producto_imagenes WHERE id_producto = $1", [id]);
            for (let i = 0; i < galeria.length; i++) {
                await client.query(
                    `INSERT INTO producto_imagenes (id_producto, ruta, orden) VALUES ($1, $2, $3)`,
                    [id, galeria[i], i]
                );
            }
        }

        await client.query("COMMIT");
        await registrarAuditoria({ idUsuario: usuario.id, accion: "PRODUCTO_ACTUALIZADO", tabla: "productos", registroId: Number(id), req });
        return r.rows[0];
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

exports.ajustar = async (data, usuario, req) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const p = await client.query("SELECT stock FROM productos WHERE id_producto=$1 FOR UPDATE", [data.id_producto]);
        if (!p.rows[0]) throw new Error("Producto no encontrado");
        const cantidad = Number(data.cantidad);
        const nuevo = Number(p.rows[0].stock) + cantidad;
        if (nuevo < 0) throw new Error("El ajuste deja el stock en negativo");
        await client.query("UPDATE productos SET stock=$1 WHERE id_producto=$2", [nuevo, data.id_producto]);
        const a = await client.query(
            `INSERT INTO ajustes_inventario(id_producto, id_usuario, tipo, cantidad, motivo)
            VALUES($1, $2, $3, $4, $5) RETURNING *`,
            [data.id_producto, usuario.id, data.tipo, cantidad, data.motivo || null]
        );
        await client.query("COMMIT");
        await registrarAuditoria({ idUsuario: usuario.id, accion: "INVENTARIO_AJUSTADO", tabla: "ajustes_inventario", registroId: a.rows[0].id_ajuste, detalle: { cantidad }, req });
        return a.rows[0];
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

exports.ajustes = async () => (await pool.query(
    `SELECT a.*, p.nombre AS producto FROM ajustes_inventario a
    JOIN productos p USING(id_producto) ORDER BY a.creado_en DESC`
)).rows;

exports.desactivar = async (id, usuario, req) => {
    const r = await pool.query("UPDATE productos SET activo=FALSE WHERE id_producto=$1 RETURNING *", [id]);
    if (!r.rows[0]) throw Object.assign(new Error("Producto no encontrado"), { status: 404 });
    await registrarAuditoria({ idUsuario: usuario.id, accion: "PRODUCTO_DESACTIVADO", tabla: "productos", registroId: Number(id), req });
    return r.rows[0];
};

// ==================== PEDIDOS PENDIENTES (PACIENTE) ====================
const buscarOCrearPaciente = async (usuario) => {
    // Buscar por correo primero
    let result = await pool.query(`SELECT * FROM pacientes WHERE correo = $1`, [usuario.correo]);
    if (result.rows[0]) return result.rows[0];

    // Si no, buscar por cédula (si existe)
    if (usuario.cedula) {
        result = await pool.query(`SELECT * FROM pacientes WHERE cedula = $1`, [usuario.cedula]);
        if (result.rows[0]) return result.rows[0];
    }

    // Crear nuevo paciente
    const newPaciente = await pool.query(
        `INSERT INTO pacientes (nombre, apellido, correo, cedula, telefono)
        VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [usuario.nombre, usuario.apellido || '', usuario.correo, usuario.cedula || null, usuario.telefono || null]
    );
    return newPaciente.rows[0];
};

exports.crearPedidoPendiente = async (data, usuario, req) => {
    const { detalles } = data;
    if (!detalles || !detalles.length) throw new Error("El pedido debe tener al menos un producto");

    const paciente = await buscarOCrearPaciente(usuario);
    const conPruebaVirtual = await soportaPruebaVirtual();

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        let subtotal = 0;
        const detallesConPrecio = [];
        for (const d of detalles) {
            const prod = await client.query(
                "SELECT precio FROM productos WHERE id_producto = $1 AND activo = TRUE",
                [d.id_producto]
            );
            if (!prod.rows[0]) throw new Error(`Producto ${d.id_producto} no existe o está inactivo`);
            const precio = Number(prod.rows[0].precio);
            const cantidad = Number(d.cantidad);
            if (cantidad <= 0) throw new Error(`Cantidad inválida para producto ${d.id_producto}`);
            subtotal += precio * cantidad;
            detallesConPrecio.push({
                ...d,
                precio_unitario: precio,
                // Imagen del probador virtual: llega solo si el paciente dio su
                // consentimiento. imagen() valida formato y tamano.
                prueba_virtual: imagen(d.prueba_virtual)
            });
        }

        const impuestos = Math.round(subtotal * 0.12 * 100) / 100; // 12% IVA simulado
        const total = subtotal + impuestos;

        const pedido = await client.query(
            `INSERT INTO pedidos_pendientes (id_paciente, subtotal, impuestos, total, estado)
            VALUES ($1, $2, $3, $4, 'PENDIENTE')
            RETURNING *`,
            [paciente.id_paciente, subtotal, impuestos, total]
        );

        for (const d of detallesConPrecio) {
            await client.query(
                conPruebaVirtual
                    ? `INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad, precio_unitario, prueba_virtual_data)
                       VALUES ($1, $2, $3, $4, $5)`
                    : `INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad, precio_unitario)
                       VALUES ($1, $2, $3, $4)`,
                conPruebaVirtual
                    ? [pedido.rows[0].id_pedido, d.id_producto, d.cantidad, d.precio_unitario, d.prueba_virtual]
                    : [pedido.rows[0].id_pedido, d.id_producto, d.cantidad, d.precio_unitario]
            );
        }

        await client.query("COMMIT");

        await registrarAuditoria({
            idUsuario: usuario.id,
            accion: "PEDIDO_PENDIENTE_CREADO",
            tabla: "pedidos_pendientes",
            registroId: pedido.rows[0].id_pedido,
            detalle: { total },
            req
        });

        return pedido.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

exports.convertirPedidoAFactura = async (idPedido, usuario, req) => {
    const facturaService = require("../factura/factura.service");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const pedidoResult = await client.query(
            `SELECT * FROM pedidos_pendientes WHERE id_pedido = $1 AND estado = 'PENDIENTE' FOR UPDATE`,
            [idPedido]
        );
        if (!pedidoResult.rows[0]) throw new Error("Pedido no encontrado o ya procesado");
        const pedido = pedidoResult.rows[0];

        const detallesResult = await client.query(
            `SELECT * FROM pedido_detalle WHERE id_pedido = $1`,
            [idPedido]
        );

        const dataFactura = {
            id_paciente: pedido.id_paciente,
            detalles: detallesResult.rows.map(d => ({
                id_producto: d.id_producto,
                descripcion: `Producto ID ${d.id_producto}`,
                cantidad: d.cantidad,
                precio_unitario: d.precio_unitario
            })),
            impuestos: pedido.impuestos,
            descuento: 0,
            pagos: [
                { forma_pago: "Efectivo", monto: pedido.total }
            ],
            es_simulada: true
        };

        const factura = await facturaService.crear(dataFactura, usuario, req);

        await client.query(
            `UPDATE pedidos_pendientes SET estado = 'COMPLETADO' WHERE id_pedido = $1`,
            [idPedido]
        );

        await client.query("COMMIT");

        await registrarAuditoria({
            idUsuario: usuario.id,
            accion: "PEDIDO_CONVERTIDO_A_FACTURA",
            tabla: "pedidos_pendientes",
            registroId: idPedido,
            detalle: { id_factura: factura.id_factura },
            req
        });

        return factura;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Devuelve la imagen del probador virtual de una linea de pedido.
 * Se sirve bajo demanda para no inflar el listado de pedidos.
 */
exports.pruebaVirtualPedido = async (idPedido, idProducto) => {
    if (!(await soportaPruebaVirtual())) {
        throw Object.assign(
            new Error("Falta aplicar la migracion 20260906120000_pedido_prueba_virtual.sql"),
            { status: 503 }
        );
    }
    const r = await pool.query(
        `SELECT prueba_virtual_data FROM pedido_detalle
         WHERE id_pedido = $1 AND id_producto = $2`,
        [idPedido, idProducto]
    );
    if (!r.rows[0]?.prueba_virtual_data) {
        throw Object.assign(new Error("Este pedido no tiene prueba virtual adjunta"), { status: 404 });
    }
    return { prueba_virtual_data: r.rows[0].prueba_virtual_data };
};

exports.listarPedidosPendientes = async (filtros = {}) => {
    const { estado = "PENDIENTE", page = 1, limit = 20 } = filtros;
    const offset = (page - 1) * limit;
    const values = [estado, limit, offset];
    const conPruebaVirtual = await soportaPruebaVirtual();
    const sql = `
        SELECT pp.*, 
            CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
            p.correo AS paciente_correo,
            (SELECT json_agg(json_build_object(
                'id_producto', pd.id_producto,
                'cantidad', pd.cantidad,
                'precio_unitario', pd.precio_unitario,
                -- Solo el indicador: la imagen se pide aparte para no cargar
                -- megabytes de base64 en cada pagina del listado.
                'tiene_prueba_virtual', ${conPruebaVirtual ? "pd.prueba_virtual_data IS NOT NULL" : "FALSE"}))
             FROM pedido_detalle pd WHERE pd.id_pedido = pp.id_pedido) AS detalles
        FROM pedidos_pendientes pp
        JOIN pacientes p ON p.id_paciente = pp.id_paciente
        WHERE pp.estado = $1
        ORDER BY pp.fecha_solicitud DESC
        LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(sql, values);
    return result.rows;
};