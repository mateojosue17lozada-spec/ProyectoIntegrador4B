import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { misPedidos } from "../services/pedidos.service";
import { PedidoPendiente } from "../types";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Cargando, EstadoVacio, Etiqueta, Tarjeta } from "../components/Base";
import { dinero, fechaLarga } from "../utils/formato";
import QRComprobante from "../components/QRComprobante";

const colorEstado = (estado: string): { fondo: string; color: string } => {
    switch (estado) {
        case "COMPLETADO":
            return { fondo: colores.exitoSuave, color: colores.exito };
        case "CANCELADO":
            return { fondo: colores.peligroSuave, color: colores.peligro };
        default:
            return { fondo: colores.avisoSuave, color: colores.aviso };
    }
};

const etiquetaEstado = (estado: string) =>
    estado === "COMPLETADO" ? "Entregado" : estado === "CANCELADO" ? "Cancelado" : "Pendiente de pago";

/**
 * Historial de pedidos web del paciente. Cada pedido pendiente puede desplegar
 * su comprobante con QR para retirarlo en la optica.
 */
export default function PedidosScreen() {
    const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [error, setError] = useState("");
    const [abierto, setAbierto] = useState<number | null>(null);

    const cargar = useCallback(async () => {
        try {
            setError("");
            setPedidos(await misPedidos());
        } catch (fallo: any) {
            setError(fallo.message || "No se pudieron cargar tus pedidos");
        } finally {
            setCargando(false);
            setRefrescando(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void cargar();
        }, [cargar])
    );

    if (cargando) return <Cargando texto="Cargando tus pedidos..." />;

    return (
        <View style={{ flex: 1, backgroundColor: colores.fondo }}>
            <FlatList
                data={pedidos}
                keyExtractor={(p) => String(p.id_pedido)}
                contentContainerStyle={e.lista}
                refreshing={refrescando}
                onRefresh={() => {
                    setRefrescando(true);
                    void cargar();
                }}
                ListHeaderComponent={error ? <Aviso texto={error} tipo="error" /> : null}
                ListEmptyComponent={
                    <EstadoVacio
                        icono="receipt-outline"
                        titulo="Aún no tienes pedidos"
                        detalle="Cuando generes un pedido desde el catálogo, aparecerá aquí con su comprobante."
                    />
                }
                renderItem={({ item }) => {
                    const desplegado = abierto === item.id_pedido;
                    const pendiente = item.estado === "PENDIENTE";
                    return (
                        <Tarjeta estilo={{ gap: espacio.sm }}>
                            <View style={e.filaEntre}>
                                <Text style={e.numero}>Pedido #{item.id_pedido}</Text>
                                <Etiqueta texto={etiquetaEstado(item.estado)} {...colorEstado(item.estado)} />
                            </View>
                            <Text style={tipografia.suave}>{fechaLarga(item.fecha_solicitud)}</Text>

                            {(item.detalles || []).filter((d) => d.id_producto).map((d) => (
                                <View key={d.id_detalle} style={e.filaEntre}>
                                    <Text style={e.producto} numberOfLines={1}>
                                        {d.cantidad}× {d.nombre_producto || "Producto"}
                                    </Text>
                                    <Text style={tipografia.suave}>
                                        {dinero(Number(d.precio_unitario) * d.cantidad)}
                                    </Text>
                                </View>
                            ))}

                            <View style={[e.filaEntre, e.totalFila]}>
                                <Text style={tipografia.seccion}>Total</Text>
                                <Text style={e.total}>{dinero(item.total)}</Text>
                            </View>

                            {pendiente && (
                                <Pressable
                                    style={e.verQr}
                                    onPress={() => setAbierto(desplegado ? null : item.id_pedido)}
                                >
                                    <Ionicons name="qr-code-outline" size={18} color={colores.primario} />
                                    <Text style={e.verQrTexto}>
                                        {desplegado ? "Ocultar comprobante" : "Ver comprobante de retiro"}
                                    </Text>
                                </Pressable>
                            )}

                            {pendiente && desplegado && (
                                <QRComprobante idPedido={item.id_pedido} total={dinero(item.total)} />
                            )}
                        </Tarjeta>
                    );
                }}
            />
        </View>
    );
}

const e = StyleSheet.create({
    lista: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    filaEntre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.sm },
    numero: { fontSize: 16, fontWeight: "700", color: colores.texto },
    producto: { flex: 1, fontSize: 14, color: colores.texto },
    totalFila: { borderTopWidth: 1, borderTopColor: colores.borde, paddingTop: espacio.sm },
    total: { fontSize: 18, fontWeight: "700", color: colores.primario },
    verQr: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: espacio.sm,
        paddingVertical: espacio.sm,
        borderRadius: radio.md,
        borderWidth: 1.5,
        borderColor: colores.primario
    },
    verQrTexto: { color: colores.primario, fontWeight: "700", fontSize: 14 }
});
