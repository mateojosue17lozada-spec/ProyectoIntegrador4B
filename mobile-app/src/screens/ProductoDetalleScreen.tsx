import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { detalleProducto } from "../services/catalogo.service";
import { useCart } from "../context/CartContext";
import { Producto } from "../types";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Boton, Cargando, Tarjeta } from "../components/Base";
import { dinero } from "../utils/formato";
import { esArmazon } from "../utils/montura";

const OPCIONES = [
    "Solo armazon",
    "Armazon + lentes de descanso",
    "Armazon + lentes graduados"
];

export default function ProductoDetalleScreen({ route, navigation }: any) {
    const { id } = route.params as { id: number };
    const { agregar } = useCart();

    const [producto, setProducto] = useState<Producto | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [opcion, setOpcion] = useState(OPCIONES[0]);
    const [cantidad, setCantidad] = useState(1);
    const [imagenActiva, setImagenActiva] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                setProducto(await detalleProducto(id));
            } catch (fallo: any) {
                setError(fallo.message || "No se pudo cargar el producto");
            } finally {
                setCargando(false);
            }
        })();
    }, [id]);

    if (cargando) return <Cargando />;
    if (error || !producto) {
        return (
            <View style={{ padding: espacio.lg }}>
                <Aviso texto={error || "Producto no encontrado"} tipo="error" />
            </View>
        );
    }

    const agotado = producto.stock <= 0;
    const puedeProbar = esArmazon(producto);

    const anadir = () => {
        agregar(producto, cantidad, opcion);
        navigation.navigate("Carrito");
    };

    // Galería: portada (imagen_data) + imágenes de producto_imagenes, sin
    // duplicados. Si no hay ninguna, se muestra el placeholder.
    const galeria: string[] = [];
    if (producto.imagen_data) galeria.push(producto.imagen_data);
    for (const img of producto.imagenes || []) {
        if (img?.ruta && !galeria.includes(img.ruta)) galeria.push(img.ruta);
    }

    return (
        <ScrollView style={{ backgroundColor: colores.fondo }} contentContainerStyle={e.contenedor}>
            <View style={e.imagenCaja}>
                {galeria.length > 0 ? (
                    <Image source={{ uri: galeria[imagenActiva] || galeria[0] }} style={e.imagen} resizeMode="contain" />
                ) : (
                    <Ionicons name="image-outline" size={64} color={colores.borde} />
                )}
            </View>

            {/* Miniaturas para navegar entre imágenes (solo si hay más de una). */}
            {galeria.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.miniaturas}>
                    {galeria.map((src, i) => (
                        <Pressable
                            key={i}
                            onPress={() => setImagenActiva(i)}
                            style={[e.miniatura, imagenActiva === i && e.miniaturaActiva]}
                        >
                            <Image source={{ uri: src }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        </Pressable>
                    ))}
                </ScrollView>
            )}

            <View style={{ gap: espacio.xs }}>
                {producto.categoria ? <Text style={e.categoria}>{producto.categoria.toUpperCase()}</Text> : null}
                <Text style={tipografia.titulo}>{producto.nombre}</Text>
                <Text style={tipografia.suave}>SKU: {producto.sku || producto.codigo_barra || "N/D"}</Text>
            </View>

            <View style={e.precioFila}>
                <Text style={e.precio}>{dinero(producto.precio)}</Text>
                {agotado ? (
                    <Text style={e.agotado}>Agotado</Text>
                ) : producto.stock <= producto.stock_minimo ? (
                    <Text style={e.ultimas}>Ultimas {producto.stock} unidades</Text>
                ) : (
                    <Text style={tipografia.suave}>{producto.stock} disponibles</Text>
                )}
            </View>

            {/* El probador se ofrece antes que la compra: es el motivo por el
                que un paciente abre esta pantalla desde el movil. */}
            {puedeProbar ? (
                <Pressable
                    style={e.probador}
                    onPress={() => navigation.navigate("Probador", { id: producto.id_producto })}
                    accessibilityRole="button"
                >
                    <View style={e.probadorIcono}>
                        <Ionicons name="glasses-outline" size={26} color={colores.textoInverso} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={e.probadorTitulo}>Probar esta montura</Text>
                        <Text style={e.probadorDetalle}>Mira como te queda antes de decidir</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colores.textoInverso} />
                </Pressable>
            ) : null}

            {producto.descripcion ? (
                <Tarjeta estilo={{ gap: espacio.xs }}>
                    <Text style={tipografia.seccion}>Descripcion</Text>
                    <Text style={tipografia.cuerpo}>{producto.descripcion}</Text>
                </Tarjeta>
            ) : null}

            <Tarjeta estilo={{ gap: espacio.sm }}>
                <Text style={tipografia.seccion}>Ficha tecnica</Text>
                <Especificacion etiqueta="Material" valor={producto.material} />
                <Especificacion etiqueta="Forma" valor={producto.forma_montura} />
                <Especificacion etiqueta="Color" valor={producto.color_montura} />
                <Especificacion etiqueta="Tipo de lente" valor={producto.tipo_lente} />
                <Especificacion etiqueta="Esfera" valor={producto.esfera} />
                <Especificacion etiqueta="Cilindro" valor={producto.cilindro} />
            </Tarjeta>

            <Tarjeta estilo={{ gap: espacio.md }}>
                <Text style={tipografia.seccion}>Opciones de compra</Text>
                {OPCIONES.map((texto) => (
                    <Pressable
                        key={texto}
                        onPress={() => setOpcion(texto)}
                        style={[e.opcion, opcion === texto && e.opcionActiva]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: opcion === texto }}
                    >
                        <Ionicons
                            name={opcion === texto ? "radio-button-on" : "radio-button-off"}
                            size={20}
                            color={opcion === texto ? colores.primario : colores.textoSuave}
                        />
                        <Text style={e.opcionTexto}>{texto}</Text>
                    </Pressable>
                ))}

                <View style={e.cantidadFila}>
                    <Text style={tipografia.cuerpo}>Cantidad</Text>
                    <View style={e.contador}>
                        <Pressable
                            onPress={() => setCantidad((previa) => Math.max(1, previa - 1))}
                            style={e.contadorBoton}
                            accessibilityLabel="Quitar una unidad"
                        >
                            <Ionicons name="remove" size={20} color={colores.primario} />
                        </Pressable>
                        <Text style={e.contadorValor}>{cantidad}</Text>
                        <Pressable
                            onPress={() => setCantidad((previa) => Math.min(producto.stock || 1, previa + 1))}
                            style={e.contadorBoton}
                            accessibilityLabel="Anadir una unidad"
                        >
                            <Ionicons name="add" size={20} color={colores.primario} />
                        </Pressable>
                    </View>
                </View>
            </Tarjeta>

            <Boton
                titulo={agotado ? "Sin stock" : "Anadir al carrito"}
                icono="cart-outline"
                onPress={anadir}
                deshabilitado={agotado}
            />
        </ScrollView>
    );
}

function Especificacion({ etiqueta, valor }: { etiqueta: string; valor: unknown }) {
    if (valor === null || valor === undefined || valor === "") return null;
    return (
        <View style={e.especificacion}>
            <Text style={tipografia.suave}>{etiqueta}</Text>
            <Text style={e.especificacionValor}>{String(valor)}</Text>
        </View>
    );
}

const e = StyleSheet.create({
    contenedor: { padding: espacio.lg, gap: espacio.lg, paddingBottom: espacio.xxl },
    imagenCaja: {
        height: 240,
        borderRadius: radio.lg,
        backgroundColor: colores.superficie,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
    },
    imagen: { width: "100%", height: "100%" },
    miniaturas: { gap: espacio.sm, paddingVertical: espacio.xs },
    miniatura: {
        width: 60,
        height: 60,
        borderRadius: radio.sm,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: colores.borde,
        backgroundColor: colores.superficie
    },
    miniaturaActiva: { borderColor: colores.primario },
    categoria: { fontSize: 11, fontWeight: "700", color: colores.primarioClaro, letterSpacing: 1 },
    precioFila: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    precio: { fontSize: 30, fontWeight: "700", color: colores.primario },
    agotado: { color: colores.peligro, fontWeight: "700" },
    ultimas: { color: colores.aviso, fontWeight: "600", fontSize: 13 },
    probador: {
        flexDirection: "row",
        alignItems: "center",
        gap: espacio.md,
        backgroundColor: colores.primario,
        borderRadius: radio.lg,
        padding: espacio.lg
    },
    probadorIcono: {
        width: 48,
        height: 48,
        borderRadius: radio.md,
        backgroundColor: colores.primarioClaro,
        alignItems: "center",
        justifyContent: "center"
    },
    probadorTitulo: { color: colores.textoInverso, fontSize: 16, fontWeight: "700" },
    probadorDetalle: { color: colores.primarioSuave, fontSize: 13 },
    especificacion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    especificacionValor: { fontSize: 14, fontWeight: "600", color: colores.texto },
    opcion: {
        flexDirection: "row",
        alignItems: "center",
        gap: espacio.sm,
        padding: espacio.md,
        borderRadius: radio.md,
        borderWidth: 1,
        borderColor: colores.borde,
        minHeight: 48
    },
    opcionActiva: { borderColor: colores.primario, backgroundColor: colores.primarioSuave },
    opcionTexto: { flex: 1, fontSize: 14, color: colores.texto },
    cantidadFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    contador: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colores.borde,
        borderRadius: radio.md,
        overflow: "hidden"
    },
    contadorBoton: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
    contadorValor: { minWidth: 40, textAlign: "center", fontSize: 16, fontWeight: "700", color: colores.texto }
});
