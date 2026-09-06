import React from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colores, espacio, radio, tipografia } from "../theme";

/**
 * Comprobante de retiro con QR. El QR codifica el pedido para que el cajero lo
 * localice al escanearlo en la web (el scanner del sistema lee este texto).
 *
 * Formato: "OPTICA:PEDIDO:<id>" — compacto y facil de parsear en el cajero.
 */
export default function QRComprobante({
    idPedido,
    total
}: {
    idPedido: number;
    total?: string;
}) {
    const contenido = `OPTICA:PEDIDO:${idPedido}`;

    return (
        <View style={e.tarjeta}>
            <Text style={e.titulo}>Comprobante de retiro</Text>
            <Text style={e.numero}>Pedido #{idPedido}</Text>

            <View style={e.qrCaja}>
                <QRCode value={contenido} size={190} color={colores.primario} backgroundColor="#FFFFFF" />
            </View>

            {total ? <Text style={e.total}>{total}</Text> : null}
            <Text style={e.ayuda}>
                Muestra este código en la óptica. El cajero lo escanea para cobrar y
                entregar tu pedido.
            </Text>
        </View>
    );
}

const e = StyleSheet.create({
    tarjeta: {
        backgroundColor: colores.superficie,
        borderRadius: radio.lg,
        padding: espacio.xl,
        alignItems: "center",
        gap: espacio.sm,
        alignSelf: "stretch"
    },
    titulo: { ...tipografia.seccion, color: colores.primario },
    numero: { fontSize: 18, fontWeight: "700", color: colores.texto },
    qrCaja: {
        padding: espacio.md,
        backgroundColor: "#FFFFFF",
        borderRadius: radio.md,
        borderWidth: 1,
        borderColor: colores.borde,
        marginVertical: espacio.sm
    },
    total: { fontSize: 22, fontWeight: "700", color: colores.primario },
    ayuda: { ...tipografia.suave, textAlign: "center", paddingHorizontal: espacio.sm }
});
