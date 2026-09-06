import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Image,
    LayoutChangeEvent,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { captureRef } from "react-native-view-shot";
import { AjusteMontura, Producto } from "../types";
import { colores, espacio, radio, tipografia } from "../theme";
import { colorMontura, esRedondeada } from "../utils/montura";
import { AJUSTE_POR_DEFECTO, ajusteDesdeRostro, cargarDetector } from "../utils/rostro";
import { Aviso, Boton } from "./Base";

/** Lado maximo de la foto. Limita memoria y respeta el CHECK de 2.2 MB del backend. */
const LADO_MAXIMO = 1080;

interface Props {
    producto: Producto;
    /** Recibe la imagen compuesta (o null si no hubo consentimiento). */
    onAnadirAlCarrito: (imagen: string | null) => void;
}

/**
 * Probador virtual de monturas sobre foto estatica.
 *
 * El ajuste manual por gestos es el camino garantizado: arrastrar mueve la
 * montura y el pellizco la escala. La deteccion facial, cuando esta disponible,
 * solo ahorra ese primer encuadre.
 */
export default function ProbadorVirtual({ producto, onAnadirAlCarrito }: Props) {
    const [foto, setFoto] = useState<string | null>(null);
    const [dimensionesFoto, setDimensionesFoto] = useState({ ancho: 0, alto: 0 });
    const [ajuste, setAjuste] = useState<AjusteMontura>(AJUSTE_POR_DEFECTO);
    const [lienzo, setLienzo] = useState({ ancho: 0, alto: 0 });
    const [analizando, setAnalizando] = useState(false);
    const [aviso, setAviso] = useState("");
    const [error, setError] = useState("");
    const [consiente, setConsiente] = useState(false);
    const [componiendo, setComponiendo] = useState(false);

    const lienzoRef = useRef<View>(null);
    // El gesto necesita leer el ajuste sin re-crear el PanResponder en cada
    // render, y guardar el estado del pellizco entre eventos.
    const ajusteRef = useRef(ajuste);
    const gestoRef = useRef({ inicial: AJUSTE_POR_DEFECTO, distanciaInicial: 0 });

    useEffect(() => {
        ajusteRef.current = ajuste;
    }, [ajuste]);

    const distanciaEntreDedos = (toques: { pageX: number; pageY: number }[]) =>
        Math.hypot(toques[0].pageX - toques[1].pageX, toques[0].pageY - toques[1].pageY);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (evento) => {
                    const toques = evento.nativeEvent.touches;
                    gestoRef.current = {
                        inicial: ajusteRef.current,
                        distanciaInicial: toques.length >= 2 ? distanciaEntreDedos(toques as any) : 0
                    };
                },
                onPanResponderMove: (evento, estado) => {
                    const toques = evento.nativeEvent.touches;
                    const { inicial, distanciaInicial } = gestoRef.current;

                    if (toques.length >= 2 && distanciaInicial > 0) {
                        const proporcion = distanciaEntreDedos(toques as any) / distanciaInicial;
                        setAjuste({
                            ...inicial,
                            anchoPct: Math.max(20, Math.min(100, inicial.anchoPct * proporcion))
                        });
                        return;
                    }

                    if (!lienzo.ancho || !lienzo.alto) return;
                    setAjuste({
                        ...inicial,
                        leftPct: Math.max(
                            5,
                            Math.min(95, inicial.leftPct + (estado.dx / lienzo.ancho) * 100)
                        ),
                        topPct: Math.max(
                            5,
                            Math.min(95, inicial.topPct + (estado.dy / lienzo.alto) * 100)
                        )
                    });
                }
            }),
        [lienzo.ancho, lienzo.alto]
    );

    /** Reduce y recomprime la foto, y lanza el encuadre automatico. */
    const procesarFoto = useCallback(async (uri: string) => {
        setError("");
        setAviso("");
        setAnalizando(true);
        try {
            const optimizada = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: LADO_MAXIMO } }],
                { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
            );

            setFoto(optimizada.uri);
            setDimensionesFoto({ ancho: optimizada.width, alto: optimizada.height });
            await encuadrar(optimizada.uri, optimizada.width, optimizada.height);
        } catch {
            setError("No se pudo procesar la imagen. Intenta con otra foto.");
        } finally {
            setAnalizando(false);
        }
    }, []);

    const encuadrar = async (uri: string, ancho: number, alto: number) => {
        const detectar = await cargarDetector();
        if (!detectar) {
            setAjuste(AJUSTE_POR_DEFECTO);
            setAviso("Coloca la montura con los dedos: arrastra para moverla y pellizca para agrandarla.");
            return;
        }
        try {
            const rostros = await detectar(uri);
            const calculado = rostros.length ? ajusteDesdeRostro(rostros[0], ancho, alto) : null;
            if (calculado) {
                setAjuste(calculado);
                setAviso("Montura encuadrada sobre tu rostro. Afinala con los dedos si hace falta.");
            } else {
                setAjuste(AJUSTE_POR_DEFECTO);
                setAviso("No detectamos el rostro. Arrastra y pellizca para colocar la montura.");
            }
        } catch {
            setAjuste(AJUSTE_POR_DEFECTO);
            setAviso("Coloca la montura con los dedos: arrastra para moverla y pellizca para agrandarla.");
        }
    };

    const tomarFoto = async () => {
        const permiso = await ImagePicker.requestCameraPermissionsAsync();
        if (!permiso.granted) {
            setError("Necesitamos permiso de camara. Puedes activarlo en los ajustes del telefono.");
            return;
        }
        const resultado = await ImagePicker.launchCameraAsync({
            cameraType: ImagePicker.CameraType.front,
            quality: 0.9,
            allowsEditing: false
        });
        if (!resultado.canceled && resultado.assets[0]) await procesarFoto(resultado.assets[0].uri);
    };

    const elegirFoto = async () => {
        const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permiso.granted) {
            setError("Necesitamos permiso para acceder a tus fotos.");
            return;
        }
        const resultado = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.9
        });
        if (!resultado.canceled && resultado.assets[0]) await procesarFoto(resultado.assets[0].uri);
    };

    /** Vuelve al inicio para probar otra montura sin salir de la pantalla. */
    const reiniciar = () => {
        setFoto(null);
        setDimensionesFoto({ ancho: 0, alto: 0 });
        setAjuste(AJUSTE_POR_DEFECTO);
        setAviso("");
        setError("");
        setConsiente(false);
    };

    const girar = (grados: number) =>
        setAjuste((previo) => ({
            ...previo,
            rotacion: Math.max(-25, Math.min(25, previo.rotacion + grados))
        }));

    const anadir = async () => {
        if (!consiente || !foto) {
            onAnadirAlCarrito(null);
            return;
        }
        setComponiendo(true);
        try {
            const base64 = await captureRef(lienzoRef, {
                format: "jpg",
                quality: 0.85,
                result: "base64"
            });
            onAnadirAlCarrito(`data:image/jpeg;base64,${base64}`);
        } catch {
            // Si la captura falla, el producto entra igual al carrito: perder la
            // foto es aceptable, perder la compra no.
            setError("No se pudo guardar la imagen, pero el producto se anadio al carrito.");
            onAnadirAlCarrito(null);
        } finally {
            setComponiendo(false);
        }
    };

    const alMedirLienzo = (evento: LayoutChangeEvent) => {
        const { width, height } = evento.nativeEvent.layout;
        setLienzo({ ancho: width, alto: height });
    };

    const anchoMontura = (ajuste.anchoPct / 100) * lienzo.ancho;
    const estiloCapa = {
        width: anchoMontura,
        left: (ajuste.leftPct / 100) * lienzo.ancho - anchoMontura / 2,
        top: (ajuste.topPct / 100) * lienzo.alto - anchoMontura * 0.18,
        transform: [{ rotate: `${ajuste.rotacion}deg` }]
    };

    return (
        <ScrollView contentContainerStyle={e.contenedor} keyboardShouldPersistTaps="handled">
            <View ref={lienzoRef} collapsable={false} style={e.lienzo} onLayout={alMedirLienzo}>
                {foto ? (
                    <>
                        <Image source={{ uri: foto }} style={e.fotoBase} resizeMode="cover" />
                        <View {...panResponder.panHandlers} style={[e.capa, estiloCapa]}>
                            {producto.imagen_data ? (
                                <Image
                                    source={{ uri: producto.imagen_data }}
                                    style={{ width: "100%", aspectRatio: 3 }}
                                    resizeMode="contain"
                                />
                            ) : (
                                <MonturaVectorial producto={producto} ancho={anchoMontura} />
                            )}
                        </View>
                    </>
                ) : (
                    <View style={e.lienzoVacio}>
                        <Ionicons name="glasses-outline" size={56} color={colores.borde} />
                        <Text style={e.lienzoTexto}>
                            Tomate una foto de frente para ver como te queda
                        </Text>
                    </View>
                )}

                {analizando && (
                    <View style={e.analizando}>
                        <Text style={e.analizandoTexto}>Analizando tu rostro...</Text>
                    </View>
                )}
            </View>

            {error ? <Aviso texto={error} tipo="error" /> : null}
            {aviso && !error ? <Aviso texto={aviso} tipo="info" /> : null}

            <View style={e.fuentes}>
                <Boton
                    titulo={foto ? "Otra foto" : "Tomar foto"}
                    icono="camera"
                    onPress={tomarFoto}
                    estilo={{ flex: 1 }}
                />
                <Boton
                    titulo="Galeria"
                    icono="images"
                    variante="secundario"
                    onPress={elegirFoto}
                    estilo={{ flex: 1 }}
                />
            </View>

            {foto && (
                <>
                    <View style={e.giro}>
                        <Pressable
                            onPress={() => girar(-3)}
                            style={e.botonGiro}
                            accessibilityLabel="Girar la montura a la izquierda"
                        >
                            <Ionicons name="return-up-back" size={20} color={colores.primario} />
                        </Pressable>
                        <Text style={tipografia.suave}>Inclinacion {Math.round(ajuste.rotacion)}°</Text>
                        <Pressable
                            onPress={() => girar(3)}
                            style={e.botonGiro}
                            accessibilityLabel="Girar la montura a la derecha"
                        >
                            <Ionicons name="return-up-forward" size={20} color={colores.primario} />
                        </Pressable>
                    </View>

                    <Boton
                        titulo="Empezar de nuevo"
                        icono="refresh"
                        variante="fantasma"
                        onPress={reiniciar}
                    />

                    <Pressable
                        style={e.consentimiento}
                        onPress={() => setConsiente((previo) => !previo)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: consiente }}
                    >
                        <Ionicons
                            name={consiente ? "checkbox" : "square-outline"}
                            size={22}
                            color={consiente ? colores.primario : colores.textoSuave}
                        />
                        <Text style={e.consentimientoTexto}>
                            Adjuntar esta foto al pedido para que el optico revise el calce. Si no lo
                            marcas, el producto se anade igual pero sin foto.
                        </Text>
                    </Pressable>
                </>
            )}

            <Boton
                titulo="Anadir al carrito"
                icono="cart"
                onPress={anadir}
                cargando={componiendo}
            />

            {dimensionesFoto.ancho > 0 && (
                <Text style={e.nota}>
                    Foto de {dimensionesFoto.ancho}x{dimensionesFoto.alto} px procesada en tu telefono.
                </Text>
            )}
        </ScrollView>
    );
}

/** Silueta de respaldo cuando el producto no tiene PNG cargado. */
function MonturaVectorial({ producto, ancho }: { producto: Producto; ancho: number }) {
    const color = colorMontura(producto);
    const redonda = esRedondeada(producto);
    const altoLente = ancho * 0.3;
    const anchoLente = ancho * 0.43;
    const grosor = Math.max(2, ancho * 0.025);

    const lente = {
        width: anchoLente,
        height: altoLente,
        borderWidth: grosor,
        borderColor: color,
        borderRadius: redonda ? altoLente / 2 : ancho * 0.06,
        backgroundColor: "rgba(205,231,242,0.18)"
    };

    return (
        <View style={e.vectorial}>
            <View style={[e.patilla, { width: ancho * 0.08, height: grosor, backgroundColor: color }]} />
            <View style={lente} />
            <View style={{ width: ancho * 0.12, height: grosor, backgroundColor: color }} />
            <View style={lente} />
            <View style={[e.patilla, { width: ancho * 0.08, height: grosor, backgroundColor: color }]} />
        </View>
    );
}

const e = StyleSheet.create({
    contenedor: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    lienzo: {
        width: "100%",
        aspectRatio: 3 / 4,
        borderRadius: radio.lg,
        overflow: "hidden",
        backgroundColor: "#0F172A"
    },
    fotoBase: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
    capa: { position: "absolute" },
    lienzoVacio: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        gap: espacio.md,
        padding: espacio.xl
    },
    lienzoTexto: { color: "#CBD5E1", textAlign: "center", fontSize: 14 },
    analizando: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: espacio.sm,
        backgroundColor: "#0F172ACC"
    },
    analizandoTexto: { color: colores.textoInverso, textAlign: "center", fontSize: 13 },
    fuentes: { flexDirection: "row", gap: espacio.sm },
    giro: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colores.superficie,
        borderRadius: radio.md,
        paddingHorizontal: espacio.md,
        paddingVertical: espacio.sm
    },
    botonGiro: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radio.sm
    },
    consentimiento: {
        flexDirection: "row",
        gap: espacio.sm,
        alignItems: "flex-start",
        backgroundColor: colores.superficie,
        borderRadius: radio.md,
        padding: espacio.md
    },
    consentimientoTexto: { flex: 1, fontSize: 13, color: colores.textoSuave, lineHeight: 18 },
    vectorial: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    patilla: { opacity: 0.9 },
    nota: { ...tipografia.suave, textAlign: "center" }
});
