import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { resumenDelDia } from "../services/caja.service";
import { agenda } from "../services/citas.service";
import { CitaAgenda, ResumenDashboard } from "../types";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Cargando, Dato, Etiqueta, Fila, Tarjeta } from "../components/Base";
import { colorEstado, fechaLarga, hora, hoyISO, iniciales } from "../utils/formato";
import { dinero } from "../utils/formato";

/**
 * Inicio del personal: agenda del dia y estado de caja.
 *
 * A diferencia del dashboard web, que muestra toda la operacion, aqui solo
 * cabe lo accionable en el momento: a quien atiendo ahora y si la caja esta
 * abierta.
 */
export default function InicioProfesionalScreen({ navigation }: any) {
    const { usuario, puedeUsarCaja } = useAuth();
    const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
    const [citasHoy, setCitasHoy] = useState<CitaAgenda[]>([]);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [error, setError] = useState("");

    const cargar = useCallback(async () => {
        try {
            setError("");
            // Se piden en paralelo y por separado: si la agenda falla, el
            // resumen sigue siendo util, y al reves.
            const [datosResumen, datosAgenda] = await Promise.allSettled([
                resumenDelDia(),
                agenda(hoyISO())
            ]);

            if (datosResumen.status === "fulfilled") setResumen(datosResumen.value);
            if (datosAgenda.status === "fulfilled") {
                const hoy = hoyISO();
                setCitasHoy(
                    datosAgenda.value
                        .filter((cita) => String(cita.fecha_cita).slice(0, 10) === hoy)
                        .sort((a, b) => String(a.hora_cita).localeCompare(String(b.hora_cita)))
                );
            }

            if (datosResumen.status === "rejected" && datosAgenda.status === "rejected") {
                setError((datosResumen.reason as Error)?.message || "No se pudieron cargar los datos");
            }
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

    if (cargando) return <Cargando texto="Cargando tu jornada..." />;

    return (
        <ScrollView
            style={{ backgroundColor: colores.fondo }}
            contentContainerStyle={e.contenedor}
            refreshControl={
                <RefreshControl
                    refreshing={refrescando}
                    onRefresh={() => {
                        setRefrescando(true);
                        void cargar();
                    }}
                    tintColor={colores.primario}
                />
            }
        >
            <View style={e.cabecera}>
                <View style={e.avatar}>
                    <Text style={e.avatarTexto}>{iniciales(usuario?.nombre, usuario?.apellido)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={e.saludo}>{usuario?.nombre?.split(" ")[0]}</Text>
                    <Text style={e.fechaHoy}>{fechaLarga(hoyISO())}</Text>
                </View>
            </View>

            {error ? <Aviso texto={error} tipo="error" /> : null}

            {resumen ? (
                <>
                    <Tarjeta estilo={{ paddingVertical: espacio.sm }}>
                        <View style={e.filaDatos}>
                            <Dato valor={resumen.citas_hoy} etiqueta="Citas hoy" icono="calendar-outline" />
                            <View style={e.separador} />
                            <Dato
                                valor={resumen.citas_pendientes}
                                etiqueta="Pendientes"
                                icono="hourglass-outline"
                            />
                            <View style={e.separador} />
                            <Dato
                                valor={resumen.atenciones_hoy}
                                etiqueta="Atendidas"
                                icono="checkmark-done-outline"
                            />
                        </View>
                    </Tarjeta>

                    {typeof resumen.ventas_hoy === "number" ? (
                        <Tarjeta estilo={e.tarjetaVentas}>
                            <Text style={e.etiquetaVentas}>VENTAS DE HOY</Text>
                            <Text style={e.montoVentas}>{dinero(resumen.ventas_hoy)}</Text>
                            <Text style={e.detalleVentas}>
                                {resumen.stock_bajo} producto(s) con stock bajo
                            </Text>
                        </Tarjeta>
                    ) : null}
                </>
            ) : null}

            <Text style={e.tituloSeccion}>Agenda de hoy</Text>
            <Tarjeta estilo={{ gap: espacio.md }}>
                {citasHoy.length ? (
                    citasHoy.slice(0, 6).map((cita) => (
                        <View key={cita.id_cita} style={e.citaFila}>
                            <View style={e.horaCaja}>
                                <Text style={e.horaTexto}>{hora(cita.hora_cita)}</Text>
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                                <Text style={e.pacienteNombre} numberOfLines={1}>
                                    {cita.paciente_nombre || `Paciente #${cita.id_paciente}`}
                                </Text>
                                <Text style={tipografia.suave} numberOfLines={1}>
                                    {cita.motivo || "Sin motivo registrado"}
                                </Text>
                            </View>
                            <Etiqueta texto={cita.estado} {...colorEstado(cita.estado)} />
                        </View>
                    ))
                ) : (
                    <View style={e.sinCitas}>
                        <Ionicons name="cafe-outline" size={32} color={colores.borde} />
                        <Text style={tipografia.suave}>No hay citas agendadas para hoy.</Text>
                    </View>
                )}
            </Tarjeta>

            {puedeUsarCaja ? (
                <>
                    <Text style={e.tituloSeccion}>Caja</Text>
                    <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
                        <Fila
                            icono="cash-outline"
                            titulo="Abrir o cerrar caja"
                            detalle="Turno del dia y arqueo"
                            onPress={() => navigation.navigate("Caja")}
                        />
                    </Tarjeta>
                </>
            ) : null}
        </ScrollView>
    );
}

const e = StyleSheet.create({
    contenedor: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.md },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: radio.completo,
        backgroundColor: colores.primarioClaro,
        alignItems: "center",
        justifyContent: "center"
    },
    avatarTexto: { color: colores.textoInverso, fontSize: 18, fontWeight: "700" },
    saludo: { fontSize: 22, fontWeight: "700", color: colores.texto },
    fechaHoy: { ...tipografia.suave, textTransform: "capitalize" },
    filaDatos: { flexDirection: "row", alignItems: "center" },
    separador: { width: 1, height: 36, backgroundColor: colores.borde },
    tarjetaVentas: { backgroundColor: colores.primario, gap: espacio.xs },
    etiquetaVentas: { color: colores.primarioSuave, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
    montoVentas: { color: colores.textoInverso, fontSize: 32, fontWeight: "700" },
    detalleVentas: { color: colores.primarioSuave, fontSize: 13 },
    tituloSeccion: { ...tipografia.seccion, marginTop: espacio.sm },
    citaFila: { flexDirection: "row", alignItems: "center", gap: espacio.md },
    horaCaja: {
        backgroundColor: colores.primarioSuave,
        paddingHorizontal: espacio.sm,
        paddingVertical: espacio.xs,
        borderRadius: radio.sm,
        minWidth: 58,
        alignItems: "center"
    },
    horaTexto: { color: colores.primario, fontWeight: "700", fontSize: 13 },
    pacienteNombre: { fontSize: 15, fontWeight: "600", color: colores.texto },
    sinCitas: { alignItems: "center", gap: espacio.sm, paddingVertical: espacio.lg }
});
