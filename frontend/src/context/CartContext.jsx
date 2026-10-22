import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
const CART_KEY = "brunch_carrito";

// El carrito se guarda en el navegador para no perderlo al recargar
// o al ir a iniciar sesión antes de pagar.
const leerCarrito = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(leerCarrito);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // Sin localStorage el carrito sigue funcionando en memoria.
    }
  }, [items]);

  // "producto" es un producto de la API: { id, nombre, precio, img_url }
  const addToCart = (producto) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === producto.id);
      if (existing) {
        return prev.map((i) => (i.id === producto.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        { id: producto.id, nombre: producto.nombre, precio: producto.precio, img: producto.img_url, qty: 1 },
      ];
    });
    setIsOpen(true);
  };

  const removeFromCart = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const updateQty = (id, qty) => {
    if (qty < 1) return removeFromCart(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.precio * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, updateQty, clearCart, total, count, isOpen, setIsOpen }}
    >
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
