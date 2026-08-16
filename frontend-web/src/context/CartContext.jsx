import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("optica_cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("optica_cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity, options = null) => {
    setCart(prev => {
      const existing = prev.find(p => p.id_producto === product.id_producto && JSON.stringify(p.options) === JSON.stringify(options));
      if (existing) {
        return prev.map(p => 
          p.id_producto === product.id_producto && JSON.stringify(p.options) === JSON.stringify(options)
            ? { ...p, cantidad: p.cantidad + quantity }
            : p
        );
      }
      return [...prev, { ...product, cantidad: quantity, options }];
    });
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
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
