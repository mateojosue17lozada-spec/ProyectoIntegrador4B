const pool = require("../../config/database");
const audit = require("../../utils/audit");

const tramo = `CASE
 WHEN CURRENT_DATE-fecha_vencimiento<=30 THEN '0-30'
 WHEN CURRENT_DATE-fecha_vencimiento<=60 THEN '31-60'
 WHEN CURRENT_DATE-fecha_vencimiento<=90 THEN '61-90' ELSE '90+' END`;

exports.obtener = async () => {
    await pool.query("UPDATE cuentas_por_cobrar SET estado='Vencida',credito_bloqueado=TRUE WHERE saldo>0 AND fecha_vencimiento<CURRENT_DATE");
    return (await pool.query(
        `SELECT 
            c.*,
            f.numero_factura,
            f.creado_en AS fecha_factura,
            f.total AS total_factura,
            p.nombre paciente_nombre,
            p.apellido paciente_apellido,
            ${tramo} antiguedad
         FROM cuentas_por_cobrar c
         JOIN facturas f ON f.id_factura = c.id_factura
         JOIN pacientes p ON p.id_paciente = c.id_paciente
         WHERE c.saldo > 0 
         ORDER BY c.fecha_vencimiento`
    )).rows;
};

exports.pagarCxc = async (id, data, usuario, req) => {
    const monto = Number(data.monto);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const cuenta = await client.query("SELECT * FROM cuentas_por_cobrar WHERE id_cxc=$1 FOR UPDATE", [id]);
        if (!cuenta.rows[0] || monto <= 0 || monto > Number(cuenta.rows[0].saldo)) {
            throw Object.assign(new Error("Cuenta o monto inválido"), { status: 400 });
        }
        await client.query("INSERT INTO abonos_cxc(id_cxc,monto,forma_pago) VALUES($1,$2,$3)", [id,monto,data.forma_pago]);
        const saldo = Number(cuenta.rows[0].saldo)-monto;
        await client.query("UPDATE cuentas_por_cobrar SET saldo=$1,estado=$2 WHERE id_cxc=$3", [saldo,saldo===0 ? "Pagada" : "Pendiente",id]);
        await client.query(
            `UPDATE cuentas_por_cobrar SET credito_bloqueado=EXISTS(
                SELECT 1 FROM cuentas_por_cobrar x WHERE x.id_paciente=$1 AND x.saldo>0 AND x.fecha_vencimiento<CURRENT_DATE
             ) WHERE id_paciente=$1`, [cuenta.rows[0].id_paciente]
        );
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "ABONO_CXC", tabla: "cuentas_por_cobrar", registroId: Number(id), detalle: { monto }, req });
        return { saldo };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};

exports.porPagar = async () => {
    await pool.query("UPDATE cuentas_por_pagar SET estado='Vencida' WHERE saldo>0 AND fecha_vencimiento<CURRENT_DATE");
    return (await pool.query(
        `SELECT c.*,p.nombre proveedor,${tramo} antiguedad
         FROM cuentas_por_pagar c JOIN proveedores p USING(id_proveedor)
         WHERE c.saldo>0 ORDER BY fecha_vencimiento`
    )).rows;
};

exports.pagarCxp = async (id, data, usuario, req) => {
    const monto = Number(data.monto);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const cuenta = await client.query("SELECT * FROM cuentas_por_pagar WHERE id_cxp=$1 FOR UPDATE", [id]);
        if (!cuenta.rows[0] || monto <= 0 || monto > Number(cuenta.rows[0].saldo)) throw Object.assign(new Error("Cuenta o monto inválido"), { status: 400 });
        const saldo = Number(cuenta.rows[0].saldo)-monto;
        await client.query("INSERT INTO abonos_cxp(id_cxp,id_usuario,monto) VALUES($1,$2,$3)", [id,usuario.id,monto]);
        await client.query("UPDATE cuentas_por_pagar SET saldo=$1,estado=$2 WHERE id_cxp=$3", [saldo,saldo===0 ? "Pagada" : "Pendiente",id]);
        await client.query("COMMIT");
        await audit({ idUsuario: usuario.id, accion: "ABONO_CXP", tabla: "cuentas_por_pagar", registroId: Number(id), detalle: { monto }, req });
        return { saldo };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};