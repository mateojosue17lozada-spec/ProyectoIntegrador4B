import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("optica_cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    try {
      localStorage.setItem("optica_cart", JSON.stringify(cart));
    } catch {
      // Las pruebas virtuales son imagenes base64 y pueden agotar la cuota de
      // localStorage (~5 MB). El carrito siempre debe sobrevivir: se reintenta
      // sin las imagenes, que son informacion accesoria.
      try {
        const sinImagenes = cart.map(item => ({ ...item, prueba_virtual: null }));
        localStorage.setItem("optica_cart", JSON.stringify(sinImagenes));
      } catch {
        localStorage.removeItem("optica_cart");
      }
    }
  }, [cart]);

  // `extras` lleva datos que no deben participar en la deduplicacion, como la
  // imagen del probador virtual: dos unidades de la misma montura siguen siendo
  // una sola linea, y la ultima prueba realizada es la que queda adjunta.
  const addToCart = (product, quantity, options = null, extras = null) => {
    setCart(prev => {
      const mismaLinea = p =>
        p.id_producto === product.id_producto && JSON.stringify(p.options) === JSON.stringify(options);
      const existing = prev.find(mismaLinea);
      if (existing) {
        return prev.map(p =>
          mismaLinea(p)
            ? { ...p, ...(extras || {}), cantidad: p.cantidad + quantity }
            : p
        );
      }
      return [...prev, { ...product, cantidad: quantity, options, ...(extras || {}) }];
    });
  };

  /** Quita la imagen del probador de una linea sin sacar el producto del carrito. */
  const removeTryOnImage = (index) => {
    setCart(prev => prev.map((p, i) => (i === index ? { ...p, prueba_virtual: null } : p)));
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index, cantidad) => {
    if (cantidad < 1) return;
    setCart(prev => prev.map((p, i) => i === index ? { ...p, cantidad } : p));
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.cantidad, 0);
  const total = cart.reduce((sum, item) => sum + (item.cantidad * Number(item.precio)), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, removeTryOnImage, updateQuantity, clearCart, totalItems, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
