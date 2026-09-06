import { api } from "./api";
import { LineaCarrito, PedidoCreado, PedidoPendiente } from "../types";

/** GET /facturacion/mis-pedidos (rol Paciente). Historial de pedidos web. */
export const misPedidos = async (): Promise<PedidoPendiente[]> => {
    const { data } = await api.get<PedidoPendiente[]>("/facturacion/mis-pedidos");
    return Array.isArray(data) ? data : [];
};

/**
 * POST /inventario/pedido (rol Paciente).
 * El backend recalcula precios desde la base: lo que se manda como precio no se
 * usa. La imagen del probador solo viaja si el paciente la autorizo.
 */
export const generarPedido = async (lineas: LineaCarrito[]): Promise<PedidoCreado> => {
    const { data } = await api.post<PedidoCreado>("/inventario/pedido", {
        detalles: lineas.map((linea) => ({
            id_producto: linea.producto.id_producto,
            cantidad: linea.cantidad,
            prueba_virtual: linea.pruebaVirtual || undefined
        }))
    });
    return data;
};
