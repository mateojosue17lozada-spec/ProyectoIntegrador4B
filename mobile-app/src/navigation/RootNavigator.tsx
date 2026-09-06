import React from "react";
import { View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { colores } from "../theme";
import { Cargando } from "../components/Base";

import LoginScreen from "../screens/LoginScreen";
import RecuperarScreen from "../screens/RecuperarScreen";
import InicioPacienteScreen from "../screens/InicioPacienteScreen";
import InicioProfesionalScreen from "../screens/InicioProfesionalScreen";
import CitasScreen from "../screens/CitasScreen";
import CatalogoScreen from "../screens/CatalogoScreen";
import ProductoDetalleScreen from "../screens/ProductoDetalleScreen";
import ProbadorScreen from "../screens/ProbadorScreen";
import CarritoScreen from "../screens/CarritoScreen";
import PerfilScreen from "../screens/PerfilScreen";
import PedidosScreen from "../screens/PedidosScreen";
import CajaScreen from "../screens/CajaScreen";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const tema = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: colores.primario,
        background: colores.fondo,
        card: colores.superficie,
        text: colores.texto,
        border: colores.borde
    }
};

const cabecera = {
    headerStyle: { backgroundColor: colores.primario },
    headerTintColor: colores.textoInverso,
    headerTitleStyle: { fontWeight: "700" as const }
};

/** Pila del catalogo: lista -> detalle -> probador. */
function PilaCatalogo() {
    return (
        <Stack.Navigator screenOptions={cabecera}>
            <Stack.Screen name="CatalogoLista" component={CatalogoScreen} options={{ title: "Catalogo" }} />
            <Stack.Screen
                name="ProductoDetalle"
                component={ProductoDetalleScreen}
                options={{ title: "Detalle" }}
            />
            <Stack.Screen
                name="Probador"
                component={ProbadorScreen}
                options={{ title: "Probador virtual" }}
            />
        </Stack.Navigator>
    );
}

/** Insignia con el numero de productos en el carrito. */
function InsigniaCarrito() {
    const { totalUnidades } = useCart();
    if (!totalUnidades) return null;
    return (
        <View
            style={{
                position: "absolute",
                top: -4,
                right: -10,
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                borderRadius: 9,
                backgroundColor: colores.acento,
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <Text style={{ color: colores.texto, fontSize: 10, fontWeight: "700" }}>
                {totalUnidades > 9 ? "9+" : totalUnidades}
            </Text>
        </View>
    );
}

function TabsPaciente() {
    return (
        <Tabs.Navigator
            screenOptions={{
                ...cabecera,
                tabBarActiveTintColor: colores.primario,
                tabBarInactiveTintColor: colores.textoSuave,
                tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 },
                tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }
            }}
        >
            <Tabs.Screen
                name="Inicio"
                component={InicioPacienteScreen}
                options={{
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="Citas"
                component={CitasScreen}
                options={{
                    title: "Mis citas",
                    tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="Catalogo"
                component={PilaCatalogo}
                options={{
                    headerShown: false,
                    title: "Catalogo",
                    tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="Carrito"
                component={CarritoScreen}
                options={{
                    title: "Mi carrito",
                    tabBarIcon: ({ color, size }) => (
                        <View>
                            <Ionicons name="cart" size={size} color={color} />
                            <InsigniaCarrito />
                        </View>
                    )
                }}
            />
            <Tabs.Screen
                name="Perfil"
                component={PerfilScreen}
                options={{
                    title: "Mi perfil",
                    tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
                }}
            />
            {/* Pedidos es navegable desde Inicio, Carrito y Perfil, pero no ocupa
                un tab propio para mantener las 5 pestañas limpias. */}
            <Tabs.Screen
                name="Pedidos"
                component={PedidosScreen}
                options={{ title: "Mis pedidos", tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
            />
        </Tabs.Navigator>
    );
}

function TabsProfesional() {
    const { puedeUsarCaja } = useAuth();
    return (
        <Tabs.Navigator
            screenOptions={{
                ...cabecera,
                tabBarActiveTintColor: colores.primario,
                tabBarInactiveTintColor: colores.textoSuave,
                tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 },
                tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }
            }}
        >
            <Tabs.Screen
                name="Jornada"
                component={InicioProfesionalScreen}
                options={{
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => <Ionicons name="today" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="Catalogo"
                component={PilaCatalogo}
                options={{
                    headerShown: false,
                    title: "Catalogo",
                    tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />
                }}
            />
            {/* La caja solo existe para quien puede operarla: el backend
                restringe /api/caja a Administrador y Cajero. */}
            {puedeUsarCaja ? (
                <Tabs.Screen
                    name="Caja"
                    component={CajaScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} />
                    }}
                />
            ) : null}
            <Tabs.Screen
                name="Perfil"
                component={PerfilScreen}
                options={{
                    title: "Mi perfil",
                    tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
                }}
            />
        </Tabs.Navigator>
    );
}

export default function RootNavigator() {
    const { usuario, cargando, esPaciente } = useAuth();

    if (cargando) return <Cargando texto="Comprobando tu sesion..." />;

    return (
        <NavigationContainer theme={tema}>
            {!usuario ? (
                <Stack.Navigator screenOptions={cabecera}>
                    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                    <Stack.Screen
                        name="Recuperar"
                        component={RecuperarScreen}
                        options={{ title: "Recuperar acceso" }}
                    />
                </Stack.Navigator>
            ) : esPaciente ? (
                <TabsPaciente />
            ) : (
                <TabsProfesional />
            )}
        </NavigationContainer>
    );
}
