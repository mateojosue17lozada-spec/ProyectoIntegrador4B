import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { actualizarPerfil, obtenerPerfil } from "../services/auth.service";
import { Perfil } from "../types";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Boton, Cargando, Tarjeta } from "../components/Base";
import { iniciales } from "../utils/formato";
import { API_URL } from "../services/api";

export default function PerfilScreen({ navigation }: any) {
    const { usuario, cerrarSesion } = useAuth();
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [exito, setExito] = useState("");

    const [nombre, setNombre] = useState("");
    const [apellido, setApellido] = useState("");
    const [telefono, setTelefono] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const datos = await obtenerPerfil();
                setPerfil(datos);
                setNombre(datos.nombre || "");
                setApellido(datos.apellido || "");
                setTelefono(datos.telefono || "");
            } catch (fallo: any) {
                setError(fallo.message || "No se pudo cargar tu perfil");
            } finally {
                setCargando(false);
            }
        })();
    }, []);

    const guardar = async () => {
        if (!nombre.trim()) {
            setError("El nombre es obligatorio.");
            return;
        }
        setGuardando(true);
        setError("");
        setExito("");
        try {
            // El backend solo acepta nombre, apellido, telefono y fecha de
            // nacimiento. El correo lo cambia el administrador.
            const actualizado = await actualizarPerfil({
                nombre: nombre.trim(),
                apellido: apellido.trim() || null,
                telefono: telefono.trim() || null,
                fecha_nacimiento: perfil?.fecha_nacimiento || null
            });
            setPerfil((previo) => (previo ? { ...previo, ...actualizado } : previo));
            setExito("Tus datos quedaron guardados.");
        } catch (fallo: any) {
            setError(fallo.message || "No se pudo guardar");
        } finally {
            setGuardando(false);
        }
    };

    const salir = () => {
        Alert.alert("Cerrar sesion", "Se borraran tus datos guardados en este telefono.", [
            { text: "Volver", style: "cancel" },
            { text: "Cerrar sesion", style: "destructive", onPress: () => void cerrarSesion() }
        ]);
    };

    if (cargando) return <Cargando texto="Cargando tu perfil..." />;

    return (
        <ScrollView style={{ backgroundColor: colores.fondo }} contentContainerStyle={e.contenedor}>
            <View style={e.cabecera}>
                <View style={e.avatar}>
                    <Text style={e.avatarTexto}>{iniciales(usuario?.nombre, usuario?.apellido)}</Text>
                </View>
                <Text style={tipografia.titulo}>
                    {perfil?.nombre} {perfil?.apellido || ""}
                </Text>
                <Text style={tipografia.suave}>{perfil?.correo}</Text>
                <View style={e.rol}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={colores.primario} />
                    <Text style={e.rolTexto}>{usuario?.rol}</Text>
                </View>
            </View>

            {error ? <Aviso texto={error} tipo="error" /> : null}
            {exito ? <Aviso texto={exito} tipo="exito" /> : null}

            <Tarjeta estilo={{ gap: espacio.md }}>
                <Text style={tipografia.seccion}>Mis datos</Text>

                <Campo etiqueta="Nombre" valor={nombre} onChange={setNombre} />
                <Campo etiqueta="Apellido" valor={apellido} onChange={setApellido} />
                <Campo etiqueta="Telefono" valor={telefono} onChange={setTelefono} teclado="phone-pad" />

                <View style={e.soloLectura}>
                    <Text style={tipografia.suave}>Correo</Text>
                    <Text style={e.soloLecturaValor}>{perfil?.correo}</Text>
                </View>
                {perfil?.cedula ? (
                    <View style={e.soloLectura}>
                        <Text style={tipografia.suave}>Cedula</Text>
                        <Text style={e.soloLecturaValor}>{perfil.cedula}</Text>
                    </View>
                ) : null}

                <Text style={tipografia.suave}>
                    El correo y la cedula solo puede cambiarlos el personal de la optica.
                </Text>

                <Boton titulo="Guardar cambios" onPress={guardar} cargando={guardando} icono="save-outline" />
            </Tarjeta>

            {perfil?.actividad_reciente?.length ? (
                <Tarjeta estilo={{ gap: espacio.sm }}>
                    <Text style={tipografia.seccion}>Actividad reciente</Text>
                    {perfil.actividad_reciente.slice(0, 5).map((registro, indice) => (
                        <View key={indice} style={e.actividad}>
                            <Ionicons name="ellipse" size={8} color={colores.primarioClaro} />
                            <Text style={tipografia.suave}>
                                {registro.accion.replace(/_/g, " ").toLowerCase()}
                            </Text>
                        </View>
                    ))}
                </Tarjeta>
            ) : null}

            {usuario?.rol === "Paciente" && (
                <Boton
                    titulo="Ver mi historial de pedidos"
                    variante="secundario"
                    icono="receipt-outline"
                    onPress={() => navigation.navigate("Pedidos")}
                />
            )}

            <Boton titulo="Cerrar sesion" variante="peligro" icono="log-out-outline" onPress={salir} />

            <Text style={e.pie}>Conectado a {API_URL}</Text>
        </ScrollView>
    );
}

function Campo({
    etiqueta,
    valor,
    onChange,
    teclado
}: {
    etiqueta: string;
    valor: string;
    onChange: (texto: string) => void;
    teclado?: "phone-pad" | "default";
}) {
    return (
        <View>
            <Text style={e.etiquetaCampo}>{etiqueta}</Text>
            <TextInput
                value={valor}
                onChangeText={onChange}
                keyboardType={teclado || "default"}
                placeholderTextColor={colores.textoSuave}
                style={e.campo}
            />
        </View>
    );
}

const e = StyleSheet.create({
    contenedor: { padding: espacio.lg, gap: espacio.md, paddingBottom: espacio.xxl },
    cabecera: { alignItems: "center", gap: espacio.xs, paddingVertical: espacio.lg },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: radio.completo,
        backgroundColor: colores.primario,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: espacio.sm
    },
    avatarTexto: { color: colores.textoInverso, fontSize: 30, fontWeight: "700" },
    rol: {
        flexDirection: "row",
        alignItems: "center",
        gap: espacio.xs,
        backgroundColor: colores.primarioSuave,
        paddingHorizontal: espacio.md,
        paddingVertical: espacio.xs,
        borderRadius: radio.completo,
        marginTop: espacio.xs
    },
    rolTexto: { color: colores.primario, fontWeight: "700", fontSize: 12 },
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
    soloLectura: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    soloLecturaValor: { fontSize: 14, fontWeight: "600", color: colores.texto },
    actividad: { flexDirection: "row", alignItems: "center", gap: espacio.sm },
    pie: { ...tipografia.suave, textAlign: "center", fontSize: 11 }
});
