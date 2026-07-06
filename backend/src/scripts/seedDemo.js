require("dotenv").config();

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/database");
const { encrypt } = require("../utils/sensitiveCrypto");

const makePassword = () => "Demo!" + crypto.randomBytes(7).toString("base64url") + "9aA";

const accounts = [
    { rol: "Administrador", nombre: "Mateo", apellido: "Lozada", usuario: "admin.demo", correo: "mateojosue17lozada@gmail.com" },
    { rol: "Optometra", nombre: "Ana", apellido: "Valencia", usuario: "optometra.demo", correo: "optometra@opticaintegral.demo" },
    { rol: "Cajero", nombre: "Carlos", apellido: "Mora", usuario: "cajero.demo", correo: "cajero@opticaintegral.demo" },
    { rol: "Vendedor", nombre: "Lucía", apellido: "Paredes", usuario: "vendedor.demo", correo: "vendedor@opticaintegral.demo" }
].map((account) => ({ ...account, password: makePassword() }));

const run = async () => {
    const hashes = await Promise.all(accounts.map((account) => bcrypt.hash(account.password, 10)));
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL statement_timeout = '30s'");
        await client.query("TRUNCATE TABLE abonos_cxc,abonos_cxp,ajustes_inventario,auditoria,caja_turnos,citas,cuentas_por_cobrar,cuentas_por_pagar,devoluciones,examen_visual,factura_detalle,factura_pagos,facturas,historias_clinicas,laboratorios,notas_credito,orden_compra_detalle,ordenes_compra,pacientes,pagos_previos,password_reset_tokens,pedidos_laboratorio,productos,promociones,proveedores,recepcion_compra_detalle,recepciones_compra,recetas,recuperacion_password,sesiones_usuario,tabla_prueba,usuarios RESTART IDENTITY CASCADE");

        await client.query("INSERT INTO roles(nombre_rol,descripcion) VALUES ('Administrador','Acceso total al sistema'),('Optometra','Gestión clínica y recetas'),('Cajero','Facturación, pagos y caja'),('Vendedor','Ventas e inventario operativo') ON CONFLICT(nombre_rol) DO UPDATE SET descripcion=EXCLUDED.descripcion");
        await client.query("INSERT INTO categorias_producto(nombre) VALUES ('Armazones'),('Micas oftalmicas'),('Lentes de contacto'),('Soluciones') ON CONFLICT(nombre) DO NOTHING");

        const rolesResult = await client.query("SELECT id_rol,nombre_rol FROM roles");
        const roleIds = Object.fromEntries(rolesResult.rows.map((row) => [row.nombre_rol, row.id_rol]));
        const userIds = {};
        for (let index = 0; index < accounts.length; index += 1) {
            const account = accounts[index];
            const result = await client.query(
                "INSERT INTO usuarios(nombre,apellido,correo,usuario,password,cedula,telefono,id_rol,estado) VALUES($1,$2,$3,$4,$5,$6,$7,$8,TRUE) RETURNING id_usuario",
                [account.nombre,account.apellido,account.correo,account.usuario,hashes[index],"095000000" + (index + 1),"099000000" + (index + 1),roleIds[account.rol]]
            );
            userIds[account.rol] = result.rows[0].id_usuario;
        }

        const patients = await client.query(
            "INSERT INTO pacientes(nombre,apellido,cedula,telefono,correo,direccion,fecha_nacimiento,lugar_nacimiento,genero,ocupacion,procedencia,uso_lentes,ultimo_control) VALUES " +
            "('María','Cedeño','0911111111','0981111111','maria.cedeno@example.com','Av. Quito 120','1992-04-14','Guayaquil','Femenino','Docente','Guayaquil',TRUE,CURRENT_DATE-INTERVAL '1 year')," +
            "('José','Mendoza','0922222222','0982222222','jose.mendoza@example.com','Cdla. Alborada Mz. 4','1985-09-22','Daule','Masculino','Conductor','Daule',FALSE,NULL)," +
            "('Sofía','Zambrano','0933333333','0983333333','sofia.zambrano@example.com','Urdesa Central','2001-01-08','Manta','Femenino','Estudiante','Guayaquil',TRUE,CURRENT_DATE-INTERVAL '8 months')," +
            "('Andrés','Vera','0944444444','0984444444','andres.vera@example.com','Samborondón Km 3','1978-11-30','Quevedo','Masculino','Ingeniero','Samborondón',TRUE,CURRENT_DATE-INTERVAL '2 years')," +
            "('Camila','Ortiz','0955555555','0985555555','camila.ortiz@example.com','Mucho Lote 2','1997-07-19','Milagro','Femenino','Diseñadora','Guayaquil',FALSE,NULL) RETURNING id_paciente,cedula"
        );
        const patientIds = Object.fromEntries(patients.rows.map((row) => [row.cedula, row.id_paciente]));

        const appointmentData = [
            [patientIds["0911111111"],"Atendida",true,"Control de miopía",35],
            [patientIds["0922222222"],"En atención",true,"Visión borrosa lejana",35],
            [patientIds["0933333333"],"Pagada",true,"Renovación de lentes",40],
            [patientIds["0944444444"],"Confirmada",false,"Fatiga visual",35],
            [patientIds["0955555555"],"Pendiente",false,"Primera valoración",30]
        ];
        const appointmentIds = [];
        for (let index = 0; index < appointmentData.length; index += 1) {
            const item = appointmentData[index];
            const result = await client.query(
                "INSERT INTO citas(id_paciente,id_usuario,fecha_cita,hora_cita,motivo,estado,pago_previo,consultorio,tarifa) VALUES($1,$2,CURRENT_DATE+$3::integer,($4 || ':00')::time,$5,$6,$7,$8,$9) RETURNING id_cita",
                [item[0],userIds.Vendedor,index - 1,String(8 + index).padStart(2, "0") + ":30",item[3],item[1],item[2],"Consultorio " + ((index % 2) + 1),item[4]]
            );
            appointmentIds.push(result.rows[0].id_cita);
        }
        for (let index = 0; index < 3; index += 1) {
            await client.query("INSERT INTO pagos_previos(id_cita,id_usuario,monto,forma_pago,referencia) VALUES($1,$2,$3,$4,$5)", [appointmentIds[index],userIds.Cajero,appointmentData[index][4],index === 1 ? "Tarjeta" : "Efectivo",index === 1 ? "DEMO-TARJETA-001" : null]);
        }

        const historyContent = (motivo, cie10) => ({
            motivo,
            anamnesis_general: "Paciente orientado, colaborador y sin alergias medicamentosas reportadas.",
            antecedentes_personales_oculares: "Uso habitual de corrección óptica.",
            antecedentes_personales_generales: "Niega enfermedades sistémicas relevantes.",
            antecedentes_familiares_oculares: "Madre con defecto refractivo.",
            antecedentes_familiares_generales: "Sin antecedentes relevantes.",
            lensometria: { od: "-1.50", oi: "-1.25", ao: "20/20", add: "0.00", tipo_lente: "Monofocal", material: "Policarbonato", filtro: "UV" },
            agudeza_visual: { av_vl_sc_od: "20/80", av_vl_sc_oi: "20/60", av_vl_sc_ao: "20/60", distancia_lejos: "6 m", distancia_cerca: "40 cm", optotipo: "Snellen" },
            examen_externo: { orbita_cejas_od: "Normal", orbita_cejas_oi: "Normal", cornea_camara_od: "Transparente", cornea_camara_oi: "Transparente" },
            reflejos_pupilares: { consensual_od: "Presente", consensual_oi: "Presente", fotomotor_od: "Presente", fotomotor_oi: "Presente" },
            oftalmoscopia: { papila_excavacion_od: "0.3", papila_excavacion_oi: "0.3", macula_fijacion_od: "Normal", macula_fijacion_oi: "Normal" },
            examen_motor: { hirschberg: "Centrado", cover_test: "Orto", ppc: "8 cm", ducciones: "Completas", versiones: "Completas" },
            queratometria_refraccion: { queratometria_od: "43.00/44.00", queratometria_oi: "43.25/44.25", rx_final: "Corrección óptica", av_vl: "20/20", av_vp: "J1" },
            diagnostico: { cie10, diagnostico_od: "Defecto refractivo", diagnostico_oi: "Defecto refractivo" },
            observaciones_patologicas: "Sin signos patológicos presuntivos.",
            tratamiento: "Uso permanente de corrección y control anual."
        });
        const histories = [];
        for (const item of [
            [patientIds["0911111111"],appointmentIds[0],"Control de miopía","H52.1",true,"María Cedeño"],
            [patientIds["0922222222"],appointmentIds[1],"Visión borrosa lejana","H52.2",false,"José Mendoza"]
        ]) {
            const result = await client.query(
                "INSERT INTO historias_clinicas(id_paciente,id_cita,id_optometra,diagnostico_cie10,datos_encriptados,consultorio,consentimiento_informado,firma_paciente,nombre_examinador,jornada,bloqueada) VALUES($1,$2,$3,$4,$5,'Consultorio 1',TRUE,$6,'Ana Valencia','Matutina',$7) RETURNING id_historia",
                [item[0],item[1],userIds.Optometra,item[3],encrypt(historyContent(item[2],item[3])),item[5],item[4]]
            );
            histories.push(result.rows[0].id_historia);
        }
        await client.query("INSERT INTO examen_visual(id_paciente,id_cita,ojo_derecho,ojo_izquierdo,diagnostico,observacion) VALUES($1,$2,'20/20 CC','20/20 CC','Miopía','Control estable'),($3,$4,'20/25 CC','20/20 CC','Astigmatismo','Requiere nueva corrección')", [patientIds["0911111111"],appointmentIds[0],patientIds["0922222222"],appointmentIds[1]]);

        const recipes = await client.query(
            "INSERT INTO recetas(id_historia,id_paciente,id_optometra,od_esfera,od_cilindro,od_eje,oi_esfera,oi_cilindro,oi_eje,adicion,observaciones,detalles,impresa) VALUES " +
            "($1,$2,$3,-1.75,-0.25,90,-1.50,-0.25,85,0,'Uso permanente',$4,TRUE)," +
            "($5,$6,$3,-0.50,-1.25,180,-0.25,-1.00,175,0,'Control en 12 meses',$7,FALSE) RETURNING id_receta",
            [histories[0],patientIds["0911111111"],userIds.Optometra,{ dnp:"62",av_vl:"20/20",av_vp:"J1",tipo_lente:"Monofocal",material:"Policarbonato",filtro:"Blue cut" },histories[1],patientIds["0922222222"],{ dnp:"64",av_vl:"20/20",av_vp:"J1",tipo_lente:"Monofocal",material:"CR-39",filtro:"UV" }]
        );

        const labs = await client.query("INSERT INTO laboratorios(nombre,telefono,correo,direccion) VALUES('Laboratorio Visión Pro','042222111','pedidos@visionpro.demo','Guayaquil'),('Óptica Lab Ecuador','042333222','ordenes@opticalab.demo','Durán') RETURNING id_laboratorio");
        await client.query("INSERT INTO pedidos_laboratorio(id_receta,id_laboratorio,descripcion,estado,estado_ensamblaje,impreso) VALUES($1,$2,'Lentes monofocales policarbonato blue cut','En proceso','Pendiente',TRUE),($3,$4,'Lentes CR-39 con filtro UV','Listo','Ensamblado',FALSE)", [recipes.rows[0].id_receta,labs.rows[0].id_laboratorio,recipes.rows[1].id_receta,labs.rows[1].id_laboratorio]);

        const categoryRows = await client.query("SELECT id_categoria,nombre FROM categorias_producto");
        const categoryIds = Object.fromEntries(categoryRows.rows.map((row) => [row.nombre, row.id_categoria]));
        const products = await client.query(
            "INSERT INTO productos(id_categoria,sku,codigo_barra,nombre,descripcion,material,esfera,cilindro,eje,stock,stock_minimo,costo,precio,tipo_lente,filtro) VALUES " +
            "($1,'ARM-NEG-001','750100000001','Armazón Urban Negro','Armazón unisex acetato','Acetato',NULL,NULL,NULL,12,3,24,55,NULL,NULL)," +
            "($1,'ARM-DOR-002','750100000002','Armazón Classic Dorado','Armazón metálico','Metal',NULL,NULL,NULL,8,2,28,65,NULL,NULL)," +
            "($2,'MICA-PC-150','750100000003','Mica policarbonato -1.50','Mica oftálmica terminada','Policarbonato',-1.50,0,0,20,5,9,24,'Monofocal','UV')," +
            "($2,'MICA-CR-AST','750100000004','Mica CR-39 astigmática','Mica oftálmica laboratorio','CR-39',-0.50,-1.25,180,6,4,12,32,'Monofocal','Blue cut')," +
            "($3,'LC-MENS-200','750100000005','Lente de contacto mensual -2.00','Caja de 6 unidades','Hidrogel',-2.00,0,0,10,3,18,38,'Contacto','UV')," +
            "($3,'LC-DIAR-100','750100000006','Lente de contacto diario -1.00','Caja de 30 unidades','Silicona hidrogel',-1.00,0,0,2,4,22,45,'Contacto','UV')," +
            "($4,'SOL-120','750100000007','Solución multipropósito 120 ml','Limpieza y conservación','Solución',NULL,NULL,NULL,15,5,3.50,8,NULL,NULL)," +
            "($4,'GOT-LUB-15','750100000008','Gotas lubricantes 15 ml','Lágrimas artificiales','Solución',NULL,NULL,NULL,3,4,4,10,NULL,NULL) RETURNING id_producto,sku",
            [categoryIds.Armazones,categoryIds["Micas oftalmicas"],categoryIds["Lentes de contacto"],categoryIds.Soluciones]
        );
        const productIds = Object.fromEntries(products.rows.map((row) => [row.sku, row.id_producto]));
        await client.query("INSERT INTO ajustes_inventario(id_producto,id_usuario,tipo,cantidad,motivo) VALUES($1,$2,'Inventario fisico',2,'Conteo inicial demo'),($3,$2,'Merma',-1,'Empaque deteriorado')", [productIds["ARM-NEG-001"],userIds.Administrador,productIds["GOT-LUB-15"]]);

        const suppliers = await client.query("INSERT INTO proveedores(nombre,ruc,telefono,correo,direccion,condiciones_credito,dias_credito) VALUES('Distribuidora Óptica Andina','0991111111001','042500100','ventas@andina.demo','Guayaquil','Crédito comercial',30),('Insumos Visuales S.A.','0992222222001','042500200','pedidos@insumos.demo','Quito','Transferencia / crédito',45) RETURNING id_proveedor");
        const purchase = await client.query("INSERT INTO ordenes_compra(id_proveedor,id_usuario,estado,total,fecha_orden) VALUES($1,$3,'Recibida',240,CURRENT_DATE-INTERVAL '10 days'),($2,$3,'Pendiente',180,CURRENT_DATE) RETURNING id_orden_compra", [suppliers.rows[0].id_proveedor,suppliers.rows[1].id_proveedor,userIds.Administrador]);
        await client.query("INSERT INTO orden_compra_detalle(id_orden_compra,id_producto,descripcion,cantidad,costo_unitario) VALUES($1,$2,'Armazón Urban Negro',10,24),($3,$4,'Lentes de contacto mensual',10,18)", [purchase.rows[0].id_orden_compra,productIds["ARM-NEG-001"],purchase.rows[1].id_orden_compra,productIds["LC-MENS-200"]]);
        const reception = await client.query("INSERT INTO recepciones_compra(id_orden_compra,factura_proveedor,id_usuario,creado_en) VALUES($1,'FAC-PROV-001',$2,CURRENT_DATE-INTERVAL '8 days') RETURNING id_recepcion", [purchase.rows[0].id_orden_compra,userIds.Administrador]);
        await client.query("INSERT INTO recepcion_compra_detalle(id_recepcion,id_producto,cantidad,costo_unitario) VALUES($1,$2,10,24)", [reception.rows[0].id_recepcion,productIds["ARM-NEG-001"]]);
        await client.query("INSERT INTO cuentas_por_pagar(id_proveedor,id_orden_compra,saldo,fecha_vencimiento,estado) VALUES($1,$2,140,CURRENT_DATE+20,'Pendiente')", [suppliers.rows[0].id_proveedor,purchase.rows[0].id_orden_compra]);
        const payable = await client.query("SELECT id_cxp FROM cuentas_por_pagar LIMIT 1");
        await client.query("INSERT INTO abonos_cxp(id_cxp,id_usuario,monto) VALUES($1,$2,100)", [payable.rows[0].id_cxp,userIds.Administrador]);

        const cash = await client.query("INSERT INTO caja_turnos(id_cajero,fecha,monto_apertura,monto_cierre,estado,abierto_en,cerrado_en) VALUES($1,CURRENT_DATE-1,100,260,'Cerrada',CURRENT_DATE-1+(INTERVAL '8 hours'),CURRENT_DATE-1+(INTERVAL '18 hours')),($1,CURRENT_DATE,100,NULL,'Abierta',NOW(),NULL) RETURNING id_caja_turno,estado", [userIds.Cajero]);
        const openCash = cash.rows.find((row) => row.estado === "Abierta").id_caja_turno;
        const promotions = await client.query("INSERT INTO promociones(nombre,porcentaje,requiere_permiso,activo) VALUES('Bienvenida',10,TRUE,TRUE),('Segunda montura',15,TRUE,TRUE) RETURNING id_promocion");
        const invoices = await client.query(
            "INSERT INTO facturas(id_paciente,id_receta,id_historia,id_caja_turno,numero_factura,subtotal,descuento,impuestos,total,estado,id_promocion) VALUES " +
            "($1,$2,$3,$4,'FAC-DEMO-001',79,7.90,0,71.10,'Emitida',$5)," +
            "($6,$7,$8,$4,'FAC-DEMO-002',97,0,0,97,'Emitida',NULL)," +
            "($9,NULL,NULL,$4,'FAC-DEMO-003',10,0,0,10,'Devuelta',NULL) RETURNING id_factura,numero_factura",
            [patientIds["0911111111"],recipes.rows[0].id_receta,histories[0],openCash,promotions.rows[0].id_promocion,patientIds["0922222222"],recipes.rows[1].id_receta,histories[1],patientIds["0933333333"]]
        );
        const invoiceIds = Object.fromEntries(invoices.rows.map((row) => [row.numero_factura, row.id_factura]));
        await client.query("INSERT INTO factura_detalle(id_factura,id_producto,descripcion,cantidad,precio_unitario,total) VALUES($1,$2,'Armazón Urban Negro',1,55,55),($1,$3,'Mica policarbonato -1.50',1,24,24),($4,$5,'Armazón Classic Dorado',1,65,65),($4,$6,'Mica CR-39 astigmática',1,32,32),($7,$8,'Gotas lubricantes 15 ml',1,10,10)", [invoiceIds["FAC-DEMO-001"],productIds["ARM-NEG-001"],productIds["MICA-PC-150"],invoiceIds["FAC-DEMO-002"],productIds["ARM-DOR-002"],productIds["MICA-CR-AST"],invoiceIds["FAC-DEMO-003"],productIds["GOT-LUB-15"]]);
        await client.query("INSERT INTO factura_pagos(id_factura,forma_pago,monto,referencia) VALUES($1,'Tarjeta',71.10,'VISA-DEMO-001'),($2,'Efectivo',40,NULL),($3,'Efectivo',10,NULL)", [invoiceIds["FAC-DEMO-001"],invoiceIds["FAC-DEMO-002"],invoiceIds["FAC-DEMO-003"]]);
        const receivable = await client.query("INSERT INTO cuentas_por_cobrar(id_paciente,id_factura,saldo,fecha_vencimiento,estado,credito_bloqueado) VALUES($1,$2,37,CURRENT_DATE+30,'Pendiente',FALSE) RETURNING id_cxc", [patientIds["0922222222"],invoiceIds["FAC-DEMO-002"]]);
        await client.query("INSERT INTO abonos_cxc(id_cxc,monto,forma_pago) VALUES($1,20,'Efectivo')", [receivable.rows[0].id_cxc]);
        const refund = await client.query("INSERT INTO devoluciones(id_factura,id_usuario,motivo,monto) VALUES($1,$2,'Producto sin abrir devuelto por paciente',10) RETURNING id_devolucion", [invoiceIds["FAC-DEMO-003"],userIds.Administrador]);
        await client.query("INSERT INTO notas_credito(id_factura,motivo,monto,id_usuario) VALUES($1,'Devolución total de producto',10,$2)", [invoiceIds["FAC-DEMO-003"],userIds.Administrador]);

        await client.query("INSERT INTO auditoria(id_usuario,accion,tabla_afectada,id_registro,detalle) VALUES($1,'SEED_DEMO_CREADO','usuarios',$1,$2),($3,'HISTORIA_CREADA','historias_clinicas',$4,$5),($6,'CAJA_ABIERTA','caja_turnos',$7,$8)", [userIds.Administrador,{ origen:"seedDemo",usuarios:4,pacientes:5 },userIds.Optometra,histories[0],{ demo:true },userIds.Cajero,openCash,{ monto_apertura:100,devolucion:refund.rows[0].id_devolucion }]);

        for (let index = 0; index < accounts.length; index += 1) {
            const valid = await bcrypt.compare(accounts[index].password, hashes[index]);
            if (!valid) throw new Error("No se pudo verificar la contraseña de " + accounts[index].usuario);
        }

        await client.query("COMMIT");
        console.log(JSON.stringify({
            success: true,
            accounts: accounts.map(({ password, ...account }) => ({ ...account, password })),
            summary: { usuarios:4,pacientes:5,citas:5,pagos_previos:3,historias:2,examenes:2,recetas:2,productos:8,proveedores:2,ordenes_compra:2,facturas:3 }
        }, null, 2));
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

run().catch((error) => {
    console.error("No se pudo crear la base demo:", error);
    process.exitCode = 1;
});
