import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { solicitarRecuperacion } from "../services/auth.service";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Boton } from "../components/Base";

export default function RecuperarScreen({ navigation }: any) {
    const [identificador, setIdentificador] = useState("");
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");

    const enviar = async () => {
        if (!identificador.trim()) {
            setError("Escribe tu usuario o tu correo.");
            return;
        }
        setCargando(true);
        setError("");
        try {
            // El backend responde igual exista o no la cuenta, para no revelar
            // que correos estan registrados.
            setMensaje(await solicitarRecuperacion(identificador));
        } catch (fallo: any) {
            setError(fallo.message || "No se pudo enviar la solicitud");
        } finally {
            setCargando(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={e.contenedor} keyboardShouldPersistTaps="handled">
            <View style={{ gap: espacio.sm }}>
                <Text style={tipografia.titulo}>Recuperar acceso</Text>
                <Text style={tipografia.suave}>
                    Te enviaremos un enlace a tu correo. El enlace caduca en 30 minutos y solo puede
                    usarse una vez.
                </Text>
            </View>

            {error ? <Aviso texto={error} tipo="error" /> : null}
            {mensaje ? <Aviso texto={mensaje} tipo="exito" /> : null}

            <View>
                <Text style={e.etiqueta}>Usuario o correo</Text>
                <TextInput
                    value={identificador}
                    onChangeText={setIdentificador}
                    placeholder="tucorreo@ejemplo.com"
                    placeholderTextColor={colores.textoSuave}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={e.campo}
                />
            </View>

            <Boton titulo="Enviar enlace" onPress={enviar} cargando={cargando} icono="mail-outline" />
            <Boton titulo="Volver" variante="fantasma" onPress={() => navigation.goBack()} />

            <Text style={tipografia.suave}>
                El restablecimiento se completa desde el enlace del correo, en el navegador.
            </Text>
        </ScrollView>
    );
}

const e = StyleSheet.create({
    contenedor: {
        flexGrow: 1,
        justifyContent: "center",
        padding: espacio.xl,
        gap: espacio.lg,
        backgroundColor: colores.fondo
    },
    etiqueta: { fontSize: 13, fontWeight: "600", color: colores.textoSuave, marginBottom: espacio.xs },
    campo: {
        backgroundColor: colores.superficie,
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
