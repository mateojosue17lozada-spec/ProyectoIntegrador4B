# Matriz visual de permisos

Leyenda: **Sí** permitido, **No** denegado, **Parcial** depende de acción/ruta concreta.

| Módulo | Acción | Administrador | Optómetra | Cajero | Vendedor | Backend | Frontend | Consistente |
|---|---|---:|---:|---:|---:|---|---|---|
| Dashboard | Consultar | Sí | Sí | Sí | Sí | Autenticado | Visible por rol | Sí |
| Pacientes | Consultar | Sí | Sí | Sí | Sí | Cuatro roles | Cuatro roles | Sí |
| Pacientes | Crear | Sí | Sí | No | Sí | Admin/Optómetra/Vendedor | Acción condicionada | Sí |
| Pacientes | Editar | Sí | Sí | No | No | Admin/Optómetra | Acción condicionada | Sí |
| Pacientes | Eliminar | Sí | No | No | No | Administrador | Acción condicionada | Sí |
| Citas | Consultar | Sí | Sí | Sí | Sí | Cuatro roles | Cuatro roles | Sí |
| Citas | Crear | Sí | No | Sí | Sí | Admin/Cajero/Vendedor | Acción condicionada | Sí |
| Citas | Pago previo | Sí | No | Sí | No | Admin/Cajero | Acción condicionada | Sí |
| Examen visual | Gestionar | Sí | Sí | No | No | Admin/Optómetra | Admin/Optómetra | Sí |
| Historia clínica | Consultar lista | Sí | Sí | No | No | Admin/Optómetra | Admin/Optómetra | Sí |
| Historia clínica | Consultar detalle | Sí | Sí | Parcial | No | Cajero puede detalle por ID | Módulo oculto a Cajero | **Parcial** |
| Historia clínica | Crear/editar/finalizar | Sí | Sí | No | No | Admin/Optómetra | Admin/Optómetra | Sí |
| Recetas | Consultar/imprimir | Sí | Sí | No | Sí | Admin/Optómetra/Vendedor | Mismos roles | Sí |
| Recetas | Crear | Sí | Sí | No | No | Admin/Optómetra | Acción condicionada | Sí |
| Pedidos laboratorio | Editar | Sí | No | No | Sí | Admin/Vendedor | Dentro de recetas | Sí |
| Inventario | Consultar | Sí | Parcial | Sí | Sí | Incluye Optómetra en listado | Módulo oculto a Optómetra | **Parcial** |
| Inventario | Crear/editar/ajustar/eliminar | Sí | No | No | No | Administrador | Acción condicionada | Sí |
| Compras/proveedores | Gestionar/aprobar | Sí | No | No | No | Administrador | Administrador | Sí |
| Facturación | Consultar/crear/imprimir | Sí | No | Sí | No | Admin/Cajero | Admin/Cajero | Sí |
| Facturación | Anular/devolver/promociones | Sí | No | No | No | Administrador | Acción condicionada | Sí |
| Caja | Gestionar | Sí | No | Sí | No | Admin/Cajero | Admin/Cajero | Sí |
| Cartera por cobrar | Consultar/cobrar | Sí | No | Sí | No | Admin/Cajero | Admin/Cajero | Sí |
| Cartera por pagar | Consultar/pagar | Sí | No | No | No | Administrador | Acción condicionada | Sí |
| Usuarios, roles y auditoría | Gestionar | Sí | No | No | No | Administrador | Administrador | Sí |
| Perfil propio | Consultar/editar datos permitidos | Sí | Sí | Sí | Sí | Autenticado | Visible en encabezado | Sí |

## Pendientes explícitos

- Definir si el acceso de Cajero al detalle de historia es necesario o debe retirarse del backend.
- Definir si Optómetra necesita consulta visual de inventario; backend y frontend no coinciden.
- No existe endpoint autenticado de cambio de contraseña; el frontend no simula esa capacidad.
- Exportar, reportes y configuración no tienen contratos completos y permanecen fuera del menú.
- Existe una cuenta con rol `Paciente`, fuera del catálogo de cuatro perfiles internos. El dashboard deniega sus métricas y el frontend no le asigna accesos operativos; debe decidirse si se migra a un rol interno o a un portal separado.

La ocultación frontend mejora la experiencia, pero la autorización efectiva continúa en middleware y rutas backend.
