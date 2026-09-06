import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";
import { generarPedido } from "../services/pedidos.service";
import { PedidoCreado } from "../types";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Boton, EstadoVacio, Tarjeta } from "../components/Base";
import QRComprobante from "../components/QRComprobante";
import { dinero } from "../utils/formato";

export default function CarritoScreen({ navigation }: any) {
    const { lineas, total, totalUnidades, cambiarCantidad, quitar, quitarPrueba, vaciar } = useCart();
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState("");
    const [pedido, setPedido] = useState<PedidoCreado | null>(null);

    const confirmar = async () => {
        setEnviando(true);
        setError("");
        try {
            const creado = await generarPedido(lineas);
            setPedido(creado);
            vaciar();
        } catch (fallo: any) {
            setError(fallo.message || "No se pudo generar el pedido");
        } finally {
            setEnviando(false);
        }
    };

    if (pedido) {
        return (
            <ScrollView contentContainerStyle={e.exito}>
                <View style={e.exitoIcono}>
                    <Ionicons name="checkmark" size={44} color={colores.textoInverso} />
                </View>
                <Text style={tipografia.titulo}>Pedido registrado</Text>

                {/* Comprobante con QR: el cajero lo escanea en la optica para
                    cobrar y entregar. Es la pieza que conecta el pedido movil con
                    la caja fisica. */}
                <QRComprobante idPedido={pedido.id_pedido} total={dinero(pedido.total)} />

                <Tarjeta estilo={{ alignSelf: "stretch", gap: espacio.sm }}>
                    <Linea etiqueta="Subtotal" valor={dinero(pedido.subtotal)} />
                    <Linea etiqueta="Impuestos" valor={dinero(pedido.impuestos)} />
                    <Linea etiqueta="Total" valor={dinero(pedido.total)} destacado />
                </Tarjeta>
                <Boton
                    titulo="Ver mis pedidos"
                    variante="secundario"
                    icono="receipt-outline"
                    onPress={() => {
                        setPedido(null);
                        navigation.navigate("Pedidos");
                    }}
                    estilo={{ alignSelf: "stretch" }}
                />
                <Boton
                    titulo="Volver al catalogo"
                    onPress={() => {
                        setPedido(null);
                        navigation.navigate("Catalogo");
                    }}
                    estilo={{ alignSelf: "stretch" }}
                />
            </ScrollView>
        );
    }

    if (!lineas.length) {
        return (
            <View style={{ flex: 1, justifyContent: "center", backgroundColor: colores.fondo }}>
                <EstadoVacio
                    icono="cart-outline"
                    titulo="Tu carrito esta vacio"
                    detalle="Explora el catalogo y pruebate una montura antes de decidir."
                />
                <Boton
                    titulo="Ir al catalogo"
                    onPress={() => navigation.navigate("Catalogo")}
                    estilo={{ marginHorizontal: espacio.xl }}
                />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colores.fondo }}>
            <ScrollView contentContainerStyle={e.contenedor}>
                {error ? <Aviso texto={error} tipo="error" /> : null}

                {lineas.map((linea, indice) => (
                    <Tarjeta key={`${linea.producto.id_producto}-${linea.opcion}`} estilo={{ gap: espacio.sm }}>
                        <View style={e.fila}>
                            <View style={e.miniatura}>
                                {linea.producto.imagen_data ? (
                                    <Image
                                        source={{ uri: linea.producto.imagen_data }}
                                        style={{ width: "100%", height: "100%" }}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <Ionicons name="image-outline" size={24} color={colores.borde} />
                                )}
                            </View>

                            <View style={{ flex: 1, gap: 2 }}>
                                <Text style={e.nombre} numberOfLines={2}>
                                    {linea.producto.nombre}
                                </Text>
                                <Text style={tipografia.suave}>{linea.opcion}</Text>
                                <Text style={e.precioUnitario}>{dinero(linea.producto.precio)} c/u</Text>
                            </View>

                            <Pressable
                                onPress={() => quitar(indice)}
                                style={e.eliminar}
                                accessibilityLabel={`Quitar ${linea.producto.nombre}`}
                            >
                                <Ionicons name="trash-outline" size={20} color={colores.peligro} />
                            </Pressable>
                        </View>

                        {/* La prueba virtual viaja al pedido para que el optico
                            revise el calce antes de confirmar la venta. */}
                        {linea.pruebaVirtual ? (
                            <View style={e.prueba}>
                                <Image source={{ uri: linea.pruebaVirtual }} style={e.pruebaImagen} />
                                <View style={{ flex: 1 }}>
                                    <Text style={e.pruebaTitulo}>Prueba virtual adjunta</Text>
                                    <Text style={tipografia.suave}>El optico vera como te queda</Text>
                                </View>
                                <Pressable onPress={() => quitarPrueba(indice)} style={e.quitarPrueba}>
                                    <Text style={e.quitarPruebaTexto}>Quitar</Text>
                                </Pressable>
                            </View>
                        ) : null}

                        <View style={e.filaEntre}>
                            <View style={e.contador}>
                                <Pressable
                                    onPress={() => cambiarCantidad(indice, linea.cantidad - 1)}
                                    style={e.contadorBoton}
                                    accessibilityLabel="Quitar una unidad"
                                >
                                    <Ionicons name="remove" size={18} color={colores.primario} />
                                </Pressable>
                                <Text style={e.contadorValor}>{linea.cantidad}</Text>
                                <Pressable
                                    onPress={() => cambiarCantidad(indice, linea.cantidad + 1)}
                                    style={e.contadorBoton}
                                    accessibilityLabel="Anadir una unidad"
                                >
                                    <Ionicons name="add" size={18} color={colores.primario} />
                                </Pressable>
                            </View>
                            <Text style={e.subtotalLinea}>
                                {dinero(linea.cantidad * Number(linea.producto.precio))}
                            </Text>
                        </View>
                    </Tarjeta>
                ))}
            </ScrollView>

            <View style={e.barraInferior}>
                <View style={e.filaEntre}>
                    <Text style={tipografia.suave}>{totalUnidades} producto(s)</Text>
                    <Text style={e.total}>{dinero(total)}</Text>
                </View>
                <Text style={e.notaIva}>Los impuestos se calculan al generar el pedido.</Text>
                <Boton
                    titulo="Generar pedido"
                    icono="checkmark-circle-outline"
                    onPress={confirmar}
                    cargando={enviando}
                />
                <Text style={e.notaPago}>El pago se realiza en la optica.</Text>
            </View>
        </View>
    );
}

function Linea({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
    return (
        <View style={e.filaEntre}>
            <Text style={destacado ? tipografia.seccion : tipografia.suave}>{etiqueta}</Text>
            <Text style={[destacado ? e.total : tipografia.cuerpo]}>{valor}</Text>
        </View>
    );
}

const e = StyleSheet.create({
    contenedor: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    fila: { flexDirection: "row", gap: espacio.md, alignItems: "center" },
    filaEntre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    miniatura: {
        width: 64,
        height: 64,
        borderRadius: radio.md,
        backgroundColor: colores.fondo,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
    },
    nombre: { fontSize: 15, fontWeight: "600", color: colores.texto },
    precioUnitario: { fontSize: 13, color: colores.primario, fontWeight: "600" },
    eliminar: { padding: espacio.sm },
    prueba: {
        flexDirection: "row",
        alignItems: "center",
        gap: espacio.sm,
        backgroundColor: colores.exitoSuave,
        borderRadius: radio.md,
        padding: espacio.sm
    },
    pruebaImagen: { width: 44, height: 44, borderRadius: radio.sm },
    pruebaTitulo: { fontSize: 13, fontWeight: "700", color: colores.exito },
    quitarPrueba: { padding: espacio.sm },
    quitarPruebaTexto: { fontSize: 12, color: colores.textoSuave, textDecorationLine: "underline" },
    contador: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colores.borde,
        borderRadius: radio.md,
        overflow: "hidden"
    },
    contadorBoton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    contadorValor: { minWidth: 34, textAlign: "center", fontSize: 15, fontWeight: "700", color: colores.texto },
    subtotalLinea: { fontSize: 16, fontWeight: "700", color: colores.texto },
    barraInferior: {
        backgroundColor: colores.superficie,
        borderTopWidth: 1,
        borderTopColor: colores.borde,
        padding: espacio.lg,
        gap: espacio.sm
    },
    total: { fontSize: 24, fontWeight: "700", color: colores.primario },
    notaIva: { ...tipografia.suave, marginBottom: espacio.xs },
    notaPago: { ...tipografia.suave, textAlign: "center" },
    exito: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: espacio.md,
        padding: espacio.xl,
        backgroundColor: colores.fondo
    },
    exitoIcono: {
        width: 84,
        height: 84,
        borderRadius: radio.completo,
        backgroundColor: colores.exito,
        alignItems: "center",
        justifyContent: "center"
    },
    numeroPedido: { fontSize: 20, fontWeight: "700", color: colores.primario }
});
