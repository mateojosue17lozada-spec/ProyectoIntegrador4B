import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { misCitas } from "../services/citas.service";
import { misPedidos } from "../services/pedidos.service";
import { Cita, PedidoPendiente } from "../types";
import { dinero } from "../utils/formato";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Boton, Cargando, Dato, Etiqueta, Fila, Tarjeta } from "../components/Base";
import { colorEstado, esProxima, fechaLarga, hora, hoyISO, iniciales } from "../utils/formato";

/**
 * Pantalla de inicio del paciente.
 *
 * Prioriza una sola pregunta: "cuando es mi proxima cita". Todo lo demas son
 * accesos rapidos. No replica el dashboard web, que es una rejilla de metricas
 * pensada para el personal.
 */
export default function InicioPacienteScreen({ navigation }: any) {
    const { usuario } = useAuth();
    const { totalUnidades } = useCart();
    const [citas, setCitas] = useState<Cita[]>([]);
    const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [error, setError] = useState("");

    const cargar = useCallback(async () => {
        try {
            setError("");
            // Citas y pedidos en paralelo; si los pedidos fallan, el resto sigue.
            const [c, p] = await Promise.allSettled([misCitas(), misPedidos()]);
            if (c.status === "fulfilled") setCitas(c.value);
            else setError(c.reason?.message || "No se pudieron cargar tus citas");
            if (p.status === "fulfilled") setPedidos(p.value);
        } catch (fallo: any) {
            setError(fallo.message || "No se pudo cargar tu información");
        } finally {
            setCargando(false);
            setRefrescando(false);
        }
    }, []);

    // Al volver de cancelar o reagendar, los datos deben estar frescos.
    useFocusEffect(
        useCallback(() => {
            void cargar();
        }, [cargar])
    );

    const { proxima, pendientes, atendidas } = useMemo(() => {
        // misCitas() llega ordenado de mas reciente a mas antigua; la proxima
        // es la mas cercana a hoy entre las futuras.
        const futuras = citas
            .filter((cita) => esProxima(cita.fecha_cita, cita.estado))
            .sort((a, b) => (a.fecha_cita + a.hora_cita).localeCompare(b.fecha_cita + b.hora_cita));

        return {
            proxima: futuras[0] || null,
            pendientes: futuras.length,
            atendidas: citas.filter((cita) => cita.estado === "Atendida" || cita.estado === "Pagada").length
        };
    }, [citas]);

    if (cargando) return <Cargando texto="Cargando tu informacion..." />;

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
                    <Text style={e.saludo}>Hola, {usuario?.nombre?.split(" ")[0]}</Text>
                    <Text style={e.fechaHoy}>{fechaLarga(hoyISO())}</Text>
                </View>
            </View>

            {error ? <Aviso texto={error} tipo="error" /> : null}

            {proxima ? (
                <Tarjeta estilo={e.tarjetaCita}>
                    <View style={e.filaEntre}>
                        <Text style={e.etiquetaCita}>TU PROXIMA CITA</Text>
                        <Etiqueta texto={proxima.estado} {...colorEstado(proxima.estado)} />
                    </View>

                    <Text style={e.fechaCita}>{fechaLarga(proxima.fecha_cita)}</Text>

                    <View style={e.detalleCita}>
                        <Ionicons name="time-outline" size={18} color={colores.primarioSuave} />
                        <Text style={e.detalleTexto}>{hora(proxima.hora_cita)}</Text>
                        {proxima.consultorio ? (
                            <>
                                <Ionicons name="location-outline" size={18} color={colores.primarioSuave} />
                                <Text style={e.detalleTexto}>{proxima.consultorio}</Text>
                            </>
                        ) : null}
                    </View>

                    {proxima.profesional_nombre ? (
                        <Text style={e.profesional}>Con {proxima.profesional_nombre}</Text>
                    ) : null}

                    <Boton
                        titulo="Gestionar cita"
                        variante="secundario"
                        icono="calendar-outline"
                        onPress={() => navigation.navigate("Citas")}
                        estilo={{ marginTop: espacio.md, backgroundColor: colores.superficie }}
                    />
                </Tarjeta>
            ) : (
                <Tarjeta>
                    <View style={e.sinCita}>
                        <Ionicons name="calendar-clear-outline" size={36} color={colores.borde} />
                        <Text style={tipografia.seccion}>No tienes citas programadas</Text>
                        <Text style={[tipografia.suave, { textAlign: "center" }]}>
                            Agenda una revision para mantener tu vision al dia.
                        </Text>
                        <Boton
                            titulo="Agendar una cita"
                            icono="add-circle-outline"
                            onPress={() => navigation.navigate("Citas")}
                            estilo={{ alignSelf: "stretch", marginTop: espacio.sm }}
                        />
                    </View>
                </Tarjeta>
            )}

            <Tarjeta estilo={{ paddingVertical: espacio.sm }}>
                <View style={e.filaDatos}>
                    <Dato valor={citas.length} etiqueta="Citas en total" icono="albums-outline" />
                    <View style={e.separador} />
                    <Dato valor={pendientes} etiqueta="Por venir" icono="hourglass-outline" />
                    <View style={e.separador} />
                    <Dato valor={atendidas} etiqueta="Atendidas" icono="checkmark-done-outline" />
                </View>
            </Tarjeta>

            {/* Último pedido: estado de un vistazo, con acceso al comprobante. */}
            {pedidos.length > 0 && (
                <>
                    <Text style={e.tituloSeccion}>Tu último pedido</Text>
                    <Tarjeta estilo={{ gap: espacio.sm }}>
                        <View style={e.filaEntre}>
                            <Text style={e.pedidoNum}>Pedido #{pedidos[0].id_pedido}</Text>
                            <Etiqueta
                                texto={
                                    pedidos[0].estado === "COMPLETADO"
                                        ? "Entregado"
                                        : pedidos[0].estado === "CANCELADO"
                                          ? "Cancelado"
                                          : "Pendiente de pago"
                                }
                                fondo={
                                    pedidos[0].estado === "COMPLETADO"
                                        ? colores.exitoSuave
                                        : pedidos[0].estado === "CANCELADO"
                                          ? colores.peligroSuave
                                          : colores.avisoSuave
                                }
                                color={
                                    pedidos[0].estado === "COMPLETADO"
                                        ? colores.exito
                                        : pedidos[0].estado === "CANCELADO"
                                          ? colores.peligro
                                          : colores.aviso
                                }
                            />
                        </View>
                        <View style={e.filaEntre}>
                            <Text style={tipografia.suave}>{dinero(pedidos[0].total)}</Text>
                            <Text style={tipografia.suave}>
                                {pedidos.filter((p) => p.estado === "PENDIENTE").length} pendiente(s) ·{" "}
                                {pedidos.filter((p) => p.estado === "COMPLETADO").length} completado(s)
                            </Text>
                        </View>
                        <Boton
                            titulo="Ver mis pedidos"
                            variante="secundario"
                            icono="receipt-outline"
                            onPress={() => navigation.navigate("Pedidos")}
                        />
                    </Tarjeta>
                </>
            )}

            <Text style={e.tituloSeccion}>Accesos rapidos</Text>
            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
                <Fila
                    icono="glasses-outline"
                    titulo="Probar lentes"
                    detalle="Mira como te queda una montura"
                    onPress={() => navigation.navigate("Catalogo")}
                />
                <Fila
                    icono="storefront-outline"
                    titulo="Explorar catalogo"
                    detalle="Monturas, micas y soluciones"
                    onPress={() => navigation.navigate("Catalogo")}
                />
                <Fila
                    icono="cart-outline"
                    titulo="Mi carrito"
                    detalle={totalUnidades ? `${totalUnidades} producto(s) listos` : "Aun esta vacio"}
                    onPress={() => navigation.navigate("Carrito")}
                />
                <Fila
                    icono="calendar-outline"
                    titulo="Mis citas"
                    detalle="Historial, cancelar o reagendar"
                    onPress={() => navigation.navigate("Citas")}
                />
                <Fila
                    icono="receipt-outline"
                    titulo="Mis pedidos"
                    detalle={pedidos.length ? `${pedidos.length} pedido(s)` : "Aun no tienes pedidos"}
                    onPress={() => navigation.navigate("Pedidos")}
                />
            </Tarjeta>
        </ScrollView>
    );
}

const e = StyleSheet.create({
    contenedor: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    cabecera: { flexDirection: "row", alignItems: "center", gap: espacio.md, marginBottom: espacio.xs },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: radio.completo,
        backgroundColor: colores.primario,
        alignItems: "center",
        justifyContent: "center"
    },
    avatarTexto: { color: colores.textoInverso, fontSize: 18, fontWeight: "700" },
    saludo: { fontSize: 22, fontWeight: "700", color: colores.texto },
    fechaHoy: { ...tipografia.suave, textTransform: "capitalize" },
    tarjetaCita: { backgroundColor: colores.primario, gap: espacio.xs },
    filaEntre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    etiquetaCita: {
        color: colores.primarioSuave,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1
    },
    fechaCita: {
        color: colores.textoInverso,
        fontSize: 20,
        fontWeight: "700",
        textTransform: "capitalize",
        marginTop: espacio.sm
    },
    detalleCita: { flexDirection: "row", alignItems: "center", gap: espacio.xs, marginTop: espacio.sm },
    detalleTexto: { color: colores.textoInverso, fontSize: 15, marginRight: espacio.md },
    profesional: { color: colores.primarioSuave, fontSize: 13, marginTop: espacio.xs },
    sinCita: { alignItems: "center", gap: espacio.sm },
    filaDatos: { flexDirection: "row", alignItems: "center" },
    separador: { width: 1, height: 36, backgroundColor: colores.borde },
    tituloSeccion: { ...tipografia.seccion, marginTop: espacio.sm },
    pedidoNum: { fontSize: 16, fontWeight: "700", color: colores.texto }
});
