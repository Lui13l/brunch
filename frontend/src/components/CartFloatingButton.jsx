import { useLocation } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import "./CartFloatingButton.css";

const CartFloatingButton = () => {
  const { count, setIsOpen } = useCart();
  const { pathname } = useLocation();

  // En la página de pago el resumen ya está a la vista y el botón taparía "Confirmar pedido".
  if (pathname === "/checkout") return null;

  return (
    <button
      type="button"
      className={`cart-floating-btn${count > 0 ? " cart-floating-btn--lleno" : ""}`}
      onClick={() => setIsOpen(true)}
      aria-label={count > 0 ? `Abrir carrito, ${count} ${count === 1 ? "ítem" : "ítems"}` : "Abrir carrito"}
    >
      <ShoppingBag size={22} strokeWidth={1.8} aria-hidden="true" />
      {/* La `key` hace que el número rebote cada vez que cambia. */}
      {count > 0 && <span key={count} className="cart-floating-badge">{count}</span>}
    </button>
  );
};

export default CartFloatingButton;
