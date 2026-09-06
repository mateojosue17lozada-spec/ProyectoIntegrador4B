import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LineaCarrito, Producto } from "../types";

const CLAVE_CARRITO = "optica_carrito";

interface ValorCarrito {
    lineas: LineaCarrito[];
    totalUnidades: number;
    total: number;
    agregar: (producto: Producto, cantidad: number, opcion: string, pruebaVirtual?: string | null) => void;
    cambiarCantidad: (indice: number, cantidad: number) => void;
    quitar: (indice: number) => void;
    quitarPrueba: (indice: number) => void;
    vaciar: () => void;
}

const CartContext = createContext<ValorCarrito | undefined>(undefined);

const mismaLinea = (linea: LineaCarrito, producto: Producto, opcion: string) =>
    linea.producto.id_producto === producto.id_producto && linea.opcion === opcion;

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [lineas, setLineas] = useState<LineaCarrito[]>([]);
    const [hidratado, setHidratado] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const guardado = await AsyncStorage.getItem(CLAVE_CARRITO);
                if (guardado) setLineas(JSON.parse(guardado) as LineaCarrito[]);
            } catch {
                await AsyncStorage.removeItem(CLAVE_CARRITO);
            } finally {
                setHidratado(true);
            }
        })();
    }, []);

    // No se persiste hasta terminar de leer, o el primer render vaciaria
    // el carrito guardado en la sesion anterior.
    useEffect(() => {
        if (!hidratado) return;
        AsyncStorage.setItem(CLAVE_CARRITO, JSON.stringify(lineas)).catch(async () => {
            // Las pruebas virtuales son base64 y pueden agotar el almacenamiento.
            // Antes que perder el carrito, se guarda sin las imagenes.
            try {
                const aligerado = lineas.map((linea) => ({ ...linea, pruebaVirtual: null }));
                await AsyncStorage.setItem(CLAVE_CARRITO, JSON.stringify(aligerado));
            } catch {
                await AsyncStorage.removeItem(CLAVE_CARRITO);
            }
        });
    }, [lineas, hidratado]);

    const agregar = useCallback<ValorCarrito["agregar"]>(
        (producto, cantidad, opcion, pruebaVirtual = null) => {
            setLineas((previas) => {
                const existente = previas.find((linea) => mismaLinea(linea, producto, opcion));
                if (!existente) {
                    return [...previas, { producto, cantidad, opcion, pruebaVirtual }];
                }
                return previas.map((linea) =>
                    mismaLinea(linea, producto, opcion)
                        ? {
                              ...linea,
                              cantidad: linea.cantidad + cantidad,
                              // La ultima prueba realizada sustituye a la anterior.
                              pruebaVirtual: pruebaVirtual ?? linea.pruebaVirtual
                          }
                        : linea
                );
            });
        },
        []
    );

    const cambiarCantidad = useCallback((indice: number, cantidad: number) => {
        if (cantidad < 1) return;
        setLineas((previas) => previas.map((linea, i) => (i === indice ? { ...linea, cantidad } : linea)));
    }, []);

    const quitar = useCallback((indice: number) => {
        setLineas((previas) => previas.filter((_, i) => i !== indice));
    }, []);

    const quitarPrueba = useCallback((indice: number) => {
        setLineas((previas) =>
            previas.map((linea, i) => (i === indice ? { ...linea, pruebaVirtual: null } : linea))
        );
    }, []);

    const vaciar = useCallback(() => setLineas([]), []);

    const valor = useMemo<ValorCarrito>(
        () => ({
            lineas,
            totalUnidades: lineas.reduce((suma, linea) => suma + linea.cantidad, 0),
            total: lineas.reduce((suma, linea) => suma + linea.cantidad * Number(linea.producto.precio), 0),
            agregar,
            cambiarCantidad,
            quitar,
            quitarPrueba,
            vaciar
        }),
        [lineas, agregar, cambiarCantidad, quitar, quitarPrueba, vaciar]
    );

    return <CartContext.Provider value={valor}>{children}</CartContext.Provider>;
}

export function useCart(): ValorCarrito {
    const contexto = useContext(CartContext);
    if (!contexto) throw new Error("useCart debe usarse dentro de CartProvider");
    return contexto;
}
