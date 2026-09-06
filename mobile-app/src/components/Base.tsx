import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextStyle,
    View,
    ViewStyle
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ALTURA_TACTIL, colores, espacio, radio, sombra, tipografia } from "../theme";

type NombreIcono = keyof typeof Ionicons.glyphMap;

/** Contenedor elevado. Unidad visual basica de toda la app. */
export function Tarjeta({ children, estilo }: { children: React.ReactNode; estilo?: ViewStyle }) {
    return <View style={[e.tarjeta, estilo]}>{children}</View>;
}

export function Boton({
    titulo,
    onPress,
    variante = "primario",
    icono,
    cargando = false,
    deshabilitado = false,
    estilo
}: {
    titulo: string;
    onPress: () => void;
    variante?: "primario" | "secundario" | "peligro" | "fantasma";
    icono?: NombreIcono;
    cargando?: boolean;
    deshabilitado?: boolean;
    estilo?: ViewStyle;
}) {
    const inactivo = deshabilitado || cargando;
    const colorTexto =
        variante === "primario" || variante === "peligro" ? colores.textoInverso : colores.primario;

    return (
        <Pressable
            onPress={onPress}
            disabled={inactivo}
            accessibilityRole="button"
            accessibilityLabel={titulo}
            style={({ pressed }) => [
                e.boton,
                variante === "primario" && { backgroundColor: colores.primario },
                variante === "secundario" && e.botonSecundario,
                variante === "peligro" && { backgroundColor: colores.peligro },
                variante === "fantasma" && { backgroundColor: "transparent" },
                inactivo && { opacity: 0.5 },
                pressed && !inactivo && { opacity: 0.85 },
                estilo
            ]}
        >
            {cargando ? (
                <ActivityIndicator color={colorTexto} />
            ) : (
                <>
                    {icono && <Ionicons name={icono} size={18} color={colorTexto} />}
                    <Text style={[e.botonTexto, { color: colorTexto }]}>{titulo}</Text>
                </>
            )}
        </Pressable>
    );
}

/** Pastilla de estado. Los colores los decide utils/formato.colorEstado. */
export function Etiqueta({ texto, fondo, color }: { texto: string; fondo: string; color: string }) {
    return (
        <View style={[e.etiqueta, { backgroundColor: fondo }]}>
            <Text style={[e.etiquetaTexto, { color }]}>{texto}</Text>
        </View>
    );
}

/** Cuadro de dato numerico para las rejillas de resumen. */
export function Dato({ valor, etiqueta, icono }: { valor: string | number; etiqueta: string; icono?: NombreIcono }) {
    return (
        <View style={e.dato}>
            {icono && <Ionicons name={icono} size={20} color={colores.primarioClaro} />}
            <Text style={tipografia.dato}>{valor}</Text>
            <Text style={e.datoEtiqueta}>{etiqueta}</Text>
        </View>
    );
}

export function EstadoVacio({
    icono,
    titulo,
    detalle
}: {
    icono: NombreIcono;
    titulo: string;
    detalle?: string;
}) {
    return (
        <View style={e.vacio}>
            <Ionicons name={icono} size={44} color={colores.borde} />
            <Text style={e.vacioTitulo}>{titulo}</Text>
            {detalle ? <Text style={e.vacioDetalle}>{detalle}</Text> : null}
        </View>
    );
}

export function Cargando({ texto = "Cargando..." }: { texto?: string }) {
    return (
        <View style={e.cargando}>
            <ActivityIndicator size="large" color={colores.primario} />
            <Text style={e.cargandoTexto}>{texto}</Text>
        </View>
    );
}

export function Aviso({ texto, tipo = "error" }: { texto: string; tipo?: "error" | "exito" | "info" }) {
    const paleta =
        tipo === "error"
            ? { fondo: colores.peligroSuave, color: colores.peligro }
            : tipo === "exito"
              ? { fondo: colores.exitoSuave, color: colores.exito }
              : { fondo: colores.primarioSuave, color: colores.primario };

    return (
        <View style={[e.aviso, { backgroundColor: paleta.fondo }]}>
            <Text style={[e.avisoTexto, { color: paleta.color }]}>{texto}</Text>
        </View>
    );
}

/** Fila pulsable con icono, usada en accesos rapidos y ajustes. */
export function Fila({
    icono,
    titulo,
    detalle,
    onPress,
    colorIcono = colores.primario
}: {
    icono: NombreIcono;
    titulo: string;
    detalle?: string;
    onPress: () => void;
    colorIcono?: string;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => [e.fila, pressed && { backgroundColor: colores.fondo }]}
        >
            <View style={[e.filaIcono, { backgroundColor: colores.primarioSuave }]}>
                <Ionicons name={icono} size={20} color={colorIcono} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={e.filaTitulo}>{titulo}</Text>
                {detalle ? <Text style={tipografia.suave}>{detalle}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colores.textoSuave} />
        </Pressable>
    );
}

const e = StyleSheet.create({
    tarjeta: {
        backgroundColor: colores.superficie,
        borderRadius: radio.lg,
        padding: espacio.lg,
        ...sombra
    },
    boton: {
        minHeight: ALTURA_TACTIL,
        borderRadius: radio.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: espacio.sm,
        paddingHorizontal: espacio.lg
    },
    botonSecundario: {
        backgroundColor: colores.superficie,
        borderWidth: 1.5,
        borderColor: colores.primario
    },
    botonTexto: { fontSize: 15, fontWeight: "700" },
    etiqueta: {
        paddingHorizontal: espacio.md,
        paddingVertical: espacio.xs,
        borderRadius: radio.completo,
        alignSelf: "flex-start"
    },
    etiquetaTexto: { fontSize: 12, fontWeight: "700" },
    dato: {
        flex: 1,
        alignItems: "center",
        gap: espacio.xs,
        paddingVertical: espacio.md
    },
    datoEtiqueta: { fontSize: 11, color: colores.textoSuave, textAlign: "center" },
    vacio: { alignItems: "center", gap: espacio.sm, paddingVertical: espacio.xxl },
    vacioTitulo: { ...tipografia.seccion, textAlign: "center" },
    vacioDetalle: {
        ...tipografia.suave,
        textAlign: "center",
        paddingHorizontal: espacio.xl
    },
    cargando: { flex: 1, alignItems: "center", justifyContent: "center", gap: espacio.md },
    cargandoTexto: tipografia.suave,
    aviso: { padding: espacio.md, borderRadius: radio.md },
    avisoTexto: { fontSize: 14, fontWeight: "600" },
    fila: {
        flexDirection: "row",
        alignItems: "center",
        gap: espacio.md,
        paddingVertical: espacio.md,
        minHeight: ALTURA_TACTIL
    },
    filaIcono: {
        width: 40,
        height: 40,
        borderRadius: radio.md,
        alignItems: "center",
        justifyContent: "center"
    },
    filaTitulo: { fontSize: 15, fontWeight: "600", color: colores.texto }
});
