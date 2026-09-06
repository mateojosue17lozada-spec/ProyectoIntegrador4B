import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colores, espacio, radio, tipografia } from "../theme";
import { Aviso, Boton } from "../components/Base";

export default function LoginScreen({ navigation }: any) {
    const { iniciarSesion } = useAuth();
    const [identificador, setIdentificador] = useState("");
    const [password, setPassword] = useState("");
    const [verPassword, setVerPassword] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");

    const entrar = async () => {
        if (!identificador.trim() || !password) {
            setError("Escribe tu usuario y tu contrasena.");
            return;
        }
        setCargando(true);
        setError("");
        try {
            await iniciarSesion(identificador, password);
        } catch (fallo: any) {
            setError(fallo.message || "No se pudo iniciar sesion");
        } finally {
            setCargando(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={e.contenedor} keyboardShouldPersistTaps="handled">
                <View style={e.marca}>
                    <View style={e.logo}>
                        <Ionicons name="eye" size={38} color={colores.textoInverso} />
                    </View>
                    <Text style={e.titulo}>Optica Integral</Text>
                    <Text style={e.subtitulo}>Tus citas y tus lentes, en tu bolsillo</Text>
                </View>

                <View style={e.formulario}>
                    {error ? <Aviso texto={error} tipo="error" /> : null}

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

                    <View>
                        <Text style={e.etiqueta}>Contrasena</Text>
                        <View style={e.campoConIcono}>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Tu contrasena"
                                placeholderTextColor={colores.textoSuave}
                                secureTextEntry={!verPassword}
                                autoCapitalize="none"
                                style={[e.campo, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                                onSubmitEditing={entrar}
                                returnKeyType="go"
                            />
                            <Pressable
                                onPress={() => setVerPassword((previo) => !previo)}
                                style={e.ojo}
                                accessibilityLabel={verPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                            >
                                <Ionicons
                                    name={verPassword ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={colores.textoSuave}
                                />
                            </Pressable>
                        </View>
                    </View>

                    <Boton titulo="Entrar" onPress={entrar} cargando={cargando} icono="log-in-outline" />

                    <Pressable onPress={() => navigation.navigate("Recuperar")} style={e.enlace}>
                        <Text style={e.enlaceTexto}>Olvide mi contrasena</Text>
                    </Pressable>
                </View>

                {/*
                    No hay pantalla de registro: POST /auth/register exige sesion
                    iniciada y rol Administrador (auth.routes.js), asi que un
                    paciente no puede crearse una cuenta por su cuenta.
                */}
                <Text style={e.nota}>
                    Las cuentas las crea el personal de la optica. Si aun no tienes uno, pidelo en
                    recepcion o por telefono.
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const e = StyleSheet.create({
    contenedor: {
        flexGrow: 1,
        justifyContent: "center",
        padding: espacio.xl,
        gap: espacio.xl,
        backgroundColor: colores.fondo
    },
    marca: { alignItems: "center", gap: espacio.sm },
    logo: {
        width: 76,
        height: 76,
        borderRadius: radio.lg,
        backgroundColor: colores.primario,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: espacio.sm
    },
    titulo: { ...tipografia.titulo, color: colores.primario },
    subtitulo: { ...tipografia.suave, textAlign: "center" },
    formulario: { gap: espacio.md },
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
    },
    campoConIcono: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colores.superficie,
        borderWidth: 1,
        borderColor: colores.borde,
        borderRadius: radio.md
    },
    ojo: { padding: espacio.md },
    enlace: { alignSelf: "center", padding: espacio.sm },
    enlaceTexto: { color: colores.primarioClaro, fontWeight: "600", fontSize: 14 },
    nota: {
        ...tipografia.suave,
        textAlign: "center",
        lineHeight: 18
    }
});
