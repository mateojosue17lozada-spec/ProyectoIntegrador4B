import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FlatList,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listarCatalogo } from "../services/catalogo.service";
import { Producto } from "../types";
import { colores, espacio, radio, sombra, tipografia } from "../theme";
import { Aviso, Cargando, EstadoVacio } from "../components/Base";
import { dinero } from "../utils/formato";
import { esArmazon } from "../utils/montura";

type Orden = "nombre" | "precio_asc" | "precio_desc";

export default function CatalogoScreen({ navigation }: any) {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [categoria, setCategoria] = useState<string>("Todos");
    const [orden, setOrden] = useState<Orden>("nombre");
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [error, setError] = useState("");

    const cargar = useCallback(async () => {
        try {
            setError("");
            setProductos(await listarCatalogo());
        } catch (fallo: any) {
            setError(fallo.message || "No se pudo cargar el catalogo");
        } finally {
            setCargando(false);
            setRefrescando(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    const categorias = useMemo(
        () => ["Todos", ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]))],
        [productos]
    );

    // El filtrado se hace en memoria: el catalogo de una optica es pequeno y
    // asi la busqueda responde a cada pulsacion sin ir al servidor.
    const visibles = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        const filtrados = productos.filter((producto) => {
            if (categoria !== "Todos" && producto.categoria !== categoria) return false;
            if (!texto) return true;
            return `${producto.nombre} ${producto.sku || ""} ${producto.descripcion || ""}`
                .toLowerCase()
                .includes(texto);
        });

        if (orden === "precio_asc") return [...filtrados].sort((a, b) => Number(a.precio) - Number(b.precio));
        if (orden === "precio_desc") return [...filtrados].sort((a, b) => Number(b.precio) - Number(a.precio));
        return [...filtrados].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [productos, busqueda, categoria, orden]);

    if (cargando) return <Cargando texto="Cargando el catalogo..." />;

    return (
        <View style={{ flex: 1, backgroundColor: colores.fondo }}>
            <View style={e.filtros}>
                <View style={e.buscador}>
                    <Ionicons name="search" size={18} color={colores.textoSuave} />
                    <TextInput
                        value={busqueda}
                        onChangeText={setBusqueda}
                        placeholder="Buscar montura, mica, solucion..."
                        placeholderTextColor={colores.textoSuave}
                        style={e.campoBusqueda}
                        returnKeyType="search"
                    />
                    {busqueda ? (
                        <Pressable onPress={() => setBusqueda("")} accessibilityLabel="Limpiar busqueda">
                            <Ionicons name="close-circle" size={18} color={colores.textoSuave} />
                        </Pressable>
                    ) : null}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.chips}>
                    {categorias.map((nombre) => (
                        <Chip
                            key={nombre}
                            texto={nombre}
                            activo={categoria === nombre}
                            onPress={() => setCategoria(nombre)}
                        />
                    ))}
                    <View style={e.separadorChips} />
                    <Chip
                        texto={orden === "precio_asc" ? "Precio ↑" : orden === "precio_desc" ? "Precio ↓" : "Nombre"}
                        activo={orden !== "nombre"}
                        onPress={() =>
                            setOrden((previo) =>
                                previo === "nombre" ? "precio_asc" : previo === "precio_asc" ? "precio_desc" : "nombre"
                            )
                        }
                    />
                </ScrollView>
            </View>

            <FlatList
                data={visibles}
                keyExtractor={(producto) => String(producto.id_producto)}
                numColumns={2}
                columnWrapperStyle={{ gap: espacio.md }}
                contentContainerStyle={e.lista}
                refreshing={refrescando}
                onRefresh={() => {
                    setRefrescando(true);
                    void cargar();
                }}
                ListHeaderComponent={error ? <Aviso texto={error} tipo="error" /> : null}
                ListEmptyComponent={
                    <EstadoVacio
                        icono="search-outline"
                        titulo="Sin resultados"
                        detalle="Prueba con otra palabra o quita los filtros."
                    />
                }
                renderItem={({ item }) => (
                    <Pressable
                        style={({ pressed }) => [e.tarjeta, pressed && { opacity: 0.85 }]}
                        onPress={() => navigation.navigate("ProductoDetalle", { id: item.id_producto })}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver ${item.nombre}`}
                    >
                        <View style={e.imagenCaja}>
                            {item.imagen_data ? (
                                <Image source={{ uri: item.imagen_data }} style={e.imagen} resizeMode="contain" />
                            ) : (
                                <Ionicons name="image-outline" size={34} color={colores.borde} />
                            )}
                            {esArmazon(item) ? (
                                <View style={e.insignia}>
                                    <Ionicons name="glasses-outline" size={12} color={colores.textoInverso} />
                                    <Text style={e.insigniaTexto}>Probar</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text style={e.nombre} numberOfLines={2}>
                            {item.nombre}
                        </Text>
                        <Text style={e.precio}>{dinero(item.precio)}</Text>
                        {item.stock <= 0 ? (
                            <Text style={e.agotado}>Agotado</Text>
                        ) : (
                            <Text style={tipografia.suave}>{item.stock} disponibles</Text>
                        )}
                    </Pressable>
                )}
            />
        </View>
    );
}

function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            style={[e.chip, activo && { backgroundColor: colores.primario, borderColor: colores.primario }]}
        >
            <Text style={[e.chipTexto, activo && { color: colores.textoInverso }]}>{texto}</Text>
        </Pressable>
    );
}

const e = StyleSheet.create({
    filtros: {
        backgroundColor: colores.superficie,
        paddingTop: espacio.md,
        paddingBottom: espacio.sm,
        gap: espacio.sm,
        borderBottomWidth: 1,
        borderBottomColor: colores.borde
    },
    buscador: {
        flexDirection: "row",
        alignItems: "center",
        gap: espacio.sm,
        marginHorizontal: espacio.lg,
        paddingHorizontal: espacio.md,
        backgroundColor: colores.fondo,
        borderRadius: radio.md,
        minHeight: 46
    },
    campoBusqueda: { flex: 1, fontSize: 15, color: colores.texto },
    chips: { paddingHorizontal: espacio.lg, gap: espacio.sm, alignItems: "center" },
    separadorChips: { width: 1, height: 22, backgroundColor: colores.borde, marginHorizontal: espacio.xs },
    chip: {
        paddingHorizontal: espacio.md,
        paddingVertical: espacio.sm,
        borderRadius: radio.completo,
        borderWidth: 1,
        borderColor: colores.borde,
        backgroundColor: colores.superficie
    },
    chipTexto: { fontSize: 13, fontWeight: "600", color: colores.textoSuave },
    lista: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    tarjeta: {
        flex: 1,
        backgroundColor: colores.superficie,
        borderRadius: radio.lg,
        padding: espacio.md,
        gap: espacio.xs,
        ...sombra
    },
    imagenCaja: {
        height: 110,
        borderRadius: radio.md,
        backgroundColor: colores.fondo,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: espacio.xs,
        overflow: "hidden"
    },
    imagen: { width: "100%", height: "100%" },
    insignia: {
        position: "absolute",
        top: espacio.xs,
        right: espacio.xs,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: colores.primario,
        paddingHorizontal: espacio.sm,
        paddingVertical: 3,
        borderRadius: radio.completo
    },
    insigniaTexto: { color: colores.textoInverso, fontSize: 10, fontWeight: "700" },
    nombre: { fontSize: 14, fontWeight: "600", color: colores.texto, minHeight: 36 },
    precio: { fontSize: 17, fontWeight: "700", color: colores.primario },
    agotado: { fontSize: 12, color: colores.peligro, fontWeight: "600" }
});
