import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { detalleProducto } from "../services/catalogo.service";
import { useCart } from "../context/CartContext";
import { Producto } from "../types";
import { colores, espacio } from "../theme";
import { Aviso, Cargando } from "../components/Base";
import ProbadorVirtual from "../components/ProbadorVirtual";

export default function ProbadorScreen({ route, navigation }: any) {
    const { id } = route.params as { id: number };
    const { agregar } = useCart();

    const [producto, setProducto] = useState<Producto | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                setProducto(await detalleProducto(id));
            } catch (fallo: any) {
                setError(fallo.message || "No se pudo cargar la montura");
            } finally {
                setCargando(false);
            }
        })();
    }, [id]);

    if (cargando) return <Cargando texto="Preparando el probador..." />;
    if (error || !producto) {
        return (
            <View style={{ padding: espacio.lg }}>
                <Aviso texto={error || "Montura no encontrada"} tipo="error" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colores.fondo }}>
            <ProbadorVirtual
                producto={producto}
                onAnadirAlCarrito={(imagen) => {
                    agregar(producto, 1, "Solo armazon", imagen);
                    navigation.navigate("Carrito");
                }}
            />
        </View>
    );
}
