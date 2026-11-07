import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import "./CartFloatingButton.css";

const CartFloatingButton = () => {
  const { count, setIsOpen } = useCart();

  return (
    <button
      type="button"
      className="cart-floating-btn"
      onClick={() => setIsOpen(true)}
      aria-label="Abrir carrito"
    >
      <ShoppingBag size={22} strokeWidth={1.8} />
      {count > 0 && <span className="cart-floating-badge">{count}</span>}
    </button>
  );
};

export default CartFloatingButton;
