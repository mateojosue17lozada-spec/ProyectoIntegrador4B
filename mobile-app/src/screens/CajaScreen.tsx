import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { abrirCaja, cerrarCaja, historialCaja, turnoAbierto } from "../services/caja.service";
import { TurnoCaja } from "../types";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Boton, Cargando, Etiqueta, Tarjeta } from "../components/Base";
import { dinero, fechaCorta, hora } from "../utils/formato";

export default function CajaScreen() {
    const [turno, setTurno] = useState<TurnoCaja | null>(null);
    const [historial, setHistorial] = useState<TurnoCaja[]>([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState(false);
    const [monto, setMonto] = useState("");
    const [observaciones, setObservaciones] = useState("");
    const [error, setError] = useState("");
    const [exito, setExito] = useState("");

    const cargar = useCallback(async () => {
        try {
            setError("");
            const [actual, previos] = await Promise.allSettled([turnoAbierto(), historialCaja()]);
            if (actual.status === "fulfilled") setTurno(actual.value);
            else setError((actual.reason as Error)?.message || "No se pudo consultar la caja");
            if (previos.status === "fulfilled") setHistorial(previos.value);
        } finally {
            setCargando(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void cargar();
        }, [cargar])
    );

    const ejecutar = async (accion: "abrir" | "cerrar") => {
        const valor = Number(monto.replace(",", "."));
        if (!Number.isFinite(valor) || valor < 0) {
            setError("Escribe un monto valido.");
            return;
        }
        setProcesando(true);
        setError("");
        setExito("");
        try {
            if (accion === "abrir") {
                await abrirCaja(valor);
                setExito("Caja abierta correctamente.");
            } else {
                const cerrado = await cerrarCaja(valor, observaciones.trim() || undefined);
                const diferencia = Number(cerrado.diferencia || 0);
                setExito(
                    diferencia === 0
                        ? "Caja cerrada sin diferencias."
                        : `Caja cerrada con una diferencia de ${dinero(diferencia)}.`
                );
            }
            setMonto("");
            setObservaciones("");
            await cargar();
        } catch (fallo: any) {
            setError(fallo.message || "No se pudo completar la operacion");
        } finally {
            setProcesando(false);
        }
    };

    if (cargando) return <Cargando texto="Consultando la caja..." />;

    return (
        <ScrollView style={{ backgroundColor: colores.fondo }} contentContainerStyle={e.contenedor}>
            {error ? <Aviso texto={error} tipo="error" /> : null}
            {exito ? <Aviso texto={exito} tipo="exito" /> : null}

            {turno ? (
                <Tarjeta estilo={e.tarjetaAbierta}>
                    <View style={e.filaEntre}>
                        <Text style={e.etiquetaTurno}>TURNO ABIERTO</Text>
                        <Etiqueta texto="Abierta" fondo={colores.exitoSuave} color={colores.exito} />
                    </View>
                    <Text style={e.montoGrande}>{dinero(turno.monto_apertura)}</Text>
                    <Text style={e.detalleTurno}>
                        Abierta el {fechaCorta(turno.fecha)} a las {hora(turno.abierto_en?.slice(11))}
                    </Text>
                </Tarjeta>
            ) : (
                <Tarjeta estilo={{ alignItems: "center", gap: espacio.sm }}>
                    <Ionicons name="lock-closed-outline" size={36} color={colores.borde} />
                    <Text style={tipografia.seccion}>No tienes caja abierta</Text>
                    <Text style={[tipografia.suave, { textAlign: "center" }]}>
                        Abre el turno con el monto inicial en efectivo para empezar a facturar.
                    </Text>
                </Tarjeta>
            )}

            <Tarjeta estilo={{ gap: espacio.md }}>
                <Text style={tipografia.seccion}>
                    {turno ? "Cerrar turno" : "Abrir turno"}
                </Text>

                <View>
                    <Text style={e.etiquetaCampo}>
                        {turno ? "Efectivo contado al cierre" : "Monto de apertura"}
                    </Text>
                    <TextInput
                        value={monto}
                        onChangeText={setMonto}
                        placeholder="0.00"
                        placeholderTextColor={colores.textoSuave}
                        keyboardType="decimal-pad"
                        style={e.campo}
                    />
                </View>

                {turno ? (
                    <View>
                        <Text style={e.etiquetaCampo}>Observaciones (opcional)</Text>
                        <TextInput
                            value={observaciones}
                            onChangeText={setObservaciones}
                            placeholder="Notas del arqueo"
                            placeholderTextColor={colores.textoSuave}
                            multiline
                            style={[e.campo, { minHeight: 80, textAlignVertical: "top" }]}
                        />
                    </View>
                ) : null}

                <Boton
                    titulo={turno ? "Cerrar caja" : "Abrir caja"}
                    icono={turno ? "lock-closed-outline" : "lock-open-outline"}
                    variante={turno ? "peligro" : "primario"}
                    onPress={() => ejecutar(turno ? "cerrar" : "abrir")}
                    cargando={procesando}
                />

                <Text style={tipografia.suave}>
                    {turno
                        ? "El sistema compara lo contado con el efectivo esperado y registra la diferencia."
                        : "Una vez cerrada, la caja del dia no puede reabrirse."}
                </Text>
            </Tarjeta>

            {historial.length ? (
                <>
                    <Text style={tipografia.seccion}>Cierres recientes</Text>
                    {historial.slice(0, 8).map((registro) => {
                        const diferencia = Number(registro.diferencia || 0);
                        return (
                            <Tarjeta key={registro.id_caja_turno} estilo={{ gap: espacio.xs }}>
                                <View style={e.filaEntre}>
                                    <Text style={e.fechaHistorial}>{fechaCorta(registro.fecha)}</Text>
                                    <Etiqueta
                                        texto={registro.estado}
                                        fondo={
                                            registro.estado === "Abierta"
                                                ? colores.exitoSuave
                                                : colores.primarioSuave
                                        }
                                        color={
                                            registro.estado === "Abierta" ? colores.exito : colores.primario
                                        }
                                    />
                                </View>
                                <View style={e.filaEntre}>
                                    <Text style={tipografia.suave}>Apertura</Text>
                                    <Text style={e.valorHistorial}>{dinero(registro.monto_apertura)}</Text>
                                </View>
                                {registro.monto_cierre !== null ? (
                                    <View style={e.filaEntre}>
                                        <Text style={tipografia.suave}>Cierre</Text>
                                        <Text style={e.valorHistorial}>{dinero(registro.monto_cierre)}</Text>
                                    </View>
                                ) : null}
                                {registro.diferencia !== null && registro.diferencia !== undefined ? (
                                    <View style={e.filaEntre}>
                                        <Text style={tipografia.suave}>Diferencia</Text>
                                        <Text
                                            style={[
                                                e.valorHistorial,
                                                {
                                                    color:
                                                        diferencia === 0
                                                            ? colores.exito
                                                            : colores.peligro
                                                }
                                            ]}
                                        >
                                            {dinero(diferencia)}
                                        </Text>
                                    </View>
                                ) : null}
                            </Tarjeta>
                        );
                    })}
                </>
            ) : null}
        </ScrollView>
    );
}

const e = StyleSheet.create({
    contenedor: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    filaEntre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    tarjetaAbierta: { gap: espacio.xs, borderLeftWidth: 4, borderLeftColor: colores.exito },
    etiquetaTurno: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colores.textoSuave },
    montoGrande: { fontSize: 30, fontWeight: "700", color: colores.primario },
    detalleTurno: tipografia.suave,
    etiquetaCampo: { fontSize: 13, fontWeight: "600", color: colores.textoSuave, marginBottom: espacio.xs },
    campo: {
        backgroundColor: colores.fondo,
        borderWidth: 1,
        borderColor: colores.borde,
        borderRadius: radio.md,
        paddingHorizontal: espacio.md,
        paddingVertical: espacio.md,
        fontSize: 16,
        color: colores.texto,
        minHeight: 50
    },
    fechaHistorial: { fontSize: 15, fontWeight: "700", color: colores.texto, textTransform: "capitalize" },
    valorHistorial: { fontSize: 14, fontWeight: "700", color: colores.texto }
});
