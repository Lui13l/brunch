import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { formatearPrecio } from "../utils/formato";
import "./CartDrawer.css";

const CartDrawer = () => {
  const { items, isOpen, setIsOpen, removeFromCart, updateQty, total, count } = useCart();
  const navigate = useNavigate();

  // Con el carrito abierto la página de atrás no se desplaza y Escape lo cierra.
  useEffect(() => {
    if (!isOpen) return undefined;
    const alTeclear = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = desbordeAnterior;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [isOpen, setIsOpen]);

  const irA = (ruta) => {
    setIsOpen(false);
    navigate(ruta);
  };

  return (
    <>
      <div
        className={`cart-overlay${isOpen ? " cart-overlay--visible" : ""}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`cart-drawer${isOpen ? " cart-drawer--open" : ""}`}
        inert={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
      >
        <div className="cart-header">
          <h2 className="cart-title">
            Tu pedido
            {count > 0 && <span className="cart-title-count">{count}</span>}
          </h2>
          <button type="button" className="cart-close" onClick={() => setIsOpen(false)} aria-label="Cerrar carrito">
            <X size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-icon" aria-hidden="true">
              <ShoppingBag size={30} strokeWidth={1.4} />
            </span>
            <p className="cart-empty-title">Tu pedido está vacío</p>
            <p className="cart-empty-text">Agrega algo de la carta y te lo llevamos a domicilio.</p>
            <button type="button" className="boton boton--primario" onClick={() => irA("/menu")}>
              Ver el menú
            </button>
          </div>
        ) : (
          <>
            <ul className="cart-items">
              {items.map((item) => (
                <li key={item.id} className="cart-item">
                  {item.img ? (
                    <img src={item.img} alt="" className="cart-item-img" />
                  ) : (
                    <span className="cart-item-img cart-item-img--vacia" aria-hidden="true" />
                  )}
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.nombre}</span>
                    <span className="cart-item-price">{formatearPrecio(item.precio * item.qty)}</span>
                    <div className="cart-item-qty">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        aria-label={`Quitar un ${item.nombre}`}
                      >
                        <Minus size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                      <span aria-live="polite">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        aria-label={`Agregar un ${item.nombre}`}
                      >
                        <Plus size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cart-item-remove"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Eliminar ${item.nombre}`}
                  >
                    <Trash2 size={17} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="cart-footer">
              <div className="cart-total">
                <span>Total ({count} {count === 1 ? "ítem" : "ítems"})</span>
                <span className="cart-total-price">{formatearPrecio(total)}</span>
              </div>
              <button type="button" className="boton boton--primario boton--ancho" onClick={() => irA("/checkout")}>
                Ir a pagar
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
};

export default CartDrawer;
