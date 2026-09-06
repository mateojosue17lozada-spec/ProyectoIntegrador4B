import React, { useCallback, useState } from "react";
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { cancelarCita, misCitas, reagendarCita } from "../services/citas.service";
import { Cita } from "../types";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Boton, Cargando, EstadoVacio, Etiqueta, Tarjeta } from "../components/Base";
import { colorEstado, esProxima, fechaLarga, hora, hoyISO } from "../utils/formato";

export default function CitasScreen() {
    const [citas, setCitas] = useState<Cita[]>([]);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [error, setError] = useState("");
    const [exito, setExito] = useState("");
    const [reagendando, setReagendando] = useState<Cita | null>(null);

    const cargar = useCallback(async () => {
        try {
            setError("");
            setCitas(await misCitas());
        } catch (fallo: any) {
            setError(fallo.message || "No se pudieron cargar tus citas");
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

    const confirmarCancelacion = (cita: Cita) => {
        Alert.alert(
            "Cancelar cita",
            `Se cancelara tu cita del ${fechaLarga(cita.fecha_cita)} a las ${hora(cita.hora_cita)}. Esta accion no se puede deshacer.`,
            [
                { text: "Volver", style: "cancel" },
                {
                    text: "Si, cancelar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await cancelarCita(cita.id_cita, "Cancelada desde la app movil");
                            setExito("Tu cita fue cancelada.");
                            await cargar();
                        } catch (fallo: any) {
                            setError(fallo.message || "No se pudo cancelar la cita");
                        }
                    }
                }
            ]
        );
    };

    if (cargando) return <Cargando texto="Cargando tus citas..." />;

    return (
        <View style={{ flex: 1, backgroundColor: colores.fondo }}>
            <FlatList
                data={citas}
                keyExtractor={(cita) => String(cita.id_cita)}
                contentContainerStyle={e.lista}
                refreshing={refrescando}
                onRefresh={() => {
                    setRefrescando(true);
                    void cargar();
                }}
                ListHeaderComponent={
                    <>
                        {error ? <Aviso texto={error} tipo="error" /> : null}
                        {exito ? <Aviso texto={exito} tipo="exito" /> : null}
                    </>
                }
                ListEmptyComponent={
                    <EstadoVacio
                        icono="calendar-clear-outline"
                        titulo="Todavia no tienes citas"
                        detalle="Cuando la optica te agende una consulta, aparecera aqui."
                    />
                }
                renderItem={({ item }) => {
                    const futura = esProxima(item.fecha_cita, item.estado);
                    return (
                        <Tarjeta estilo={{ gap: espacio.sm }}>
                            <View style={e.filaEntre}>
                                <Text style={e.fecha}>{fechaLarga(item.fecha_cita)}</Text>
                                <Etiqueta texto={item.estado} {...colorEstado(item.estado)} />
                            </View>

                            <View style={e.metadatos}>
                                <Ionicons name="time-outline" size={16} color={colores.textoSuave} />
                                <Text style={tipografia.suave}>{hora(item.hora_cita)}</Text>
                                {item.consultorio ? (
                                    <>
                                        <Ionicons name="business-outline" size={16} color={colores.textoSuave} />
                                        <Text style={tipografia.suave}>{item.consultorio}</Text>
                                    </>
                                ) : null}
                            </View>

                            {item.profesional_nombre ? (
                                <Text style={tipografia.suave}>Profesional: {item.profesional_nombre}</Text>
                            ) : null}
                            {item.motivo ? <Text style={tipografia.cuerpo}>{item.motivo}</Text> : null}

                            {item.pago_previo ? (
                                <View style={e.pagado}>
                                    <Ionicons name="checkmark-circle" size={16} color={colores.exito} />
                                    <Text style={e.pagadoTexto}>Abono registrado</Text>
                                </View>
                            ) : null}

                            {/* Solo las citas futuras y no canceladas admiten cambios. */}
                            {futura ? (
                                <View style={e.acciones}>
                                    <Boton
                                        titulo="Reagendar"
                                        variante="secundario"
                                        icono="swap-horizontal-outline"
                                        onPress={() => {
                                            setExito("");
                                            setError("");
                                            setReagendando(item);
                                        }}
                                        estilo={{ flex: 1 }}
                                    />
                                    <Boton
                                        titulo="Cancelar"
                                        variante="peligro"
                                        icono="close-circle-outline"
                                        onPress={() => confirmarCancelacion(item)}
                                        estilo={{ flex: 1 }}
                                    />
                                </View>
                            ) : null}
                        </Tarjeta>
                    );
                }}
            />

            <ModalReagendar
                cita={reagendando}
                onCerrar={() => setReagendando(null)}
                onListo={async (mensaje) => {
                    setReagendando(null);
                    setExito(mensaje);
                    await cargar();
                }}
                onError={setError}
            />
        </View>
    );
}

/**
 * Reagendar pide fecha y hora en texto para no arrastrar una dependencia de
 * calendario. El backend valida que no sean pasadas y devuelve el mensaje.
 */
function ModalReagendar({
    cita,
    onCerrar,
    onListo,
    onError
}: {
    cita: Cita | null;
    onCerrar: () => void;
    onListo: (mensaje: string) => Promise<void>;
    onError: (mensaje: string) => void;
}) {
    const [fecha, setFecha] = useState("");
    const [horaNueva, setHoraNueva] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [errorLocal, setErrorLocal] = useState("");

    const cerrar = () => {
        setFecha("");
        setHoraNueva("");
        setErrorLocal("");
        onCerrar();
    };

    const guardar = async () => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            setErrorLocal("La fecha debe tener el formato AAAA-MM-DD.");
            return;
        }
        if (!/^\d{2}:\d{2}$/.test(horaNueva)) {
            setErrorLocal("La hora debe tener el formato HH:MM.");
            return;
        }
        if (!cita) return;

        setGuardando(true);
        setErrorLocal("");
        try {
            await reagendarCita(cita.id_cita, fecha, horaNueva);
            setFecha("");
            setHoraNueva("");
            await onListo("Tu cita fue reagendada.");
        } catch (fallo: any) {
            // El backend devuelve mensajes utiles (fecha pasada, horario ocupado);
            // se muestran dentro del modal, junto al formulario.
            setErrorLocal(fallo.message || "No se pudo reagendar");
            onError("");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal visible={Boolean(cita)} animationType="slide" transparent onRequestClose={cerrar}>
            <View style={e.fondoModal}>
                <View style={e.modal}>
                    <Text style={tipografia.seccion}>Reagendar cita</Text>
                    <Text style={tipografia.suave}>
                        Cita actual: {cita ? fechaLarga(cita.fecha_cita) : ""} a las{" "}
                        {cita ? hora(cita.hora_cita) : ""}
                    </Text>

                    {errorLocal ? <Aviso texto={errorLocal} tipo="error" /> : null}

                    <View>
                        <Text style={e.etiquetaCampo}>Nueva fecha</Text>
                        <TextInput
                            value={fecha}
                            onChangeText={setFecha}
                            placeholder={hoyISO()}
                            placeholderTextColor={colores.textoSuave}
                            keyboardType="numbers-and-punctuation"
                            style={e.campo}
                        />
                    </View>

                    <View>
                        <Text style={e.etiquetaCampo}>Nueva hora</Text>
                        <TextInput
                            value={horaNueva}
                            onChangeText={setHoraNueva}
                            placeholder="15:30"
                            placeholderTextColor={colores.textoSuave}
                            keyboardType="numbers-and-punctuation"
                            style={e.campo}
                        />
                    </View>

                    <Boton titulo="Confirmar cambio" onPress={guardar} cargando={guardando} />
                    <Boton titulo="Volver" variante="fantasma" onPress={cerrar} />
                </View>
            </View>
        </Modal>
    );
}

const e = StyleSheet.create({
    lista: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    filaEntre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espacio.sm },
    fecha: { fontSize: 16, fontWeight: "700", color: colores.texto, textTransform: "capitalize", flex: 1 },
    metadatos: { flexDirection: "row", alignItems: "center", gap: espacio.xs, flexWrap: "wrap" },
    pagado: { flexDirection: "row", alignItems: "center", gap: espacio.xs },
    pagadoTexto: { color: colores.exito, fontSize: 13, fontWeight: "600" },
    acciones: { flexDirection: "row", gap: espacio.sm, marginTop: espacio.xs },
    fondoModal: { flex: 1, backgroundColor: "#0F172ACC", justifyContent: "flex-end" },
    modal: {
        backgroundColor: colores.superficie,
        borderTopLeftRadius: radio.lg,
        borderTopRightRadius: radio.lg,
        padding: espacio.xl,
        gap: espacio.md
    },
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
    }
});
