import { api } from "./api";
import { Producto } from "../types";

export interface FiltrosCatalogo {
    buscar?: string;
    categoria?: string;
    orden?: "precio_asc" | "precio_desc";
}

/** GET /inventario/catalogo. Requiere sesion, sin restriccion de rol. */
export const listarCatalogo = async (filtros: FiltrosCatalogo = {}): Promise<Producto[]> => {
    const { data } = await api.get<Producto[]>("/inventario/catalogo", { params: filtros });
    return Array.isArray(data) ? data : [];
};

/** GET /inventario/catalogo/:id. Solo productos con activo = TRUE. */
export const detalleProducto = async (id: number | string): Promise<Producto> => {
    const { data } = await api.get<Producto>(`/inventario/catalogo/${id}`);
    return data;
};
