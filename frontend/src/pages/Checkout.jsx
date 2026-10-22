import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { api, formatearPrecio } from "../api";
import "./Checkout.css";

const METODOS = {
  efectivo: "Efectivo contra entrega",
  transferencia: "Transferencia / Nequi",
  tarjeta: "Tarjeta en puerta",
};

const Checkout = () => {
  const { items, total, clearCart } = useCart();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [direccion, setDireccion] = useState(user?.direccion || "");
  const [telefono, setTelefono] = useState(user?.celular || "");
  const [metodo, setMetodo] = useState("efectivo");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Si el pedido se creó pero falló el pago, al reintentar no se duplica el pedido.
  const [pedidoCreado, setPedidoCreado] = useState(null);
  const [confirmado, setConfirmado] = useState(null);

  if (items.length === 0 && !confirmado) return <Navigate to="/menu" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);

    try {
      const pedido =
        pedidoCreado ||
        (await api.post("/pedidos", {
          items: items.map((i) => ({ menu_item_id: i.id, cantidad: i.qty })),
          direccion_pedido: direccion,
          observaciones: notas || undefined,
        }));
      setPedidoCreado(pedido);

      const pago = await api.post("/pagos", { pedido_id: pedido.id, metodo });

      // El pedido no guarda teléfono: se guarda en el perfil para que el
      // restaurante pueda contactar al cliente y para rellenarlo la próxima vez.
      if (telefono !== user.celular || !user.direccion) {
        const perfil = await api
          .put("/usuarios/perfil", { celular: telefono, direccion: user.direccion || direccion })
          .catch(() => null);
        if (perfil) setUser(perfil);
      }

      clearCart();
      setConfirmado({ total: pedido.total, metodo: pago.metodo });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleModalAccept = () => {
    navigate("/");
  };

  return (
    <>
      <Navbar />

      <main className="checkout-main">
        <div className="checkout-grid">

          {/* Resumen del pedido */}
          <section className="checkout-summary">
            <span className="checkout-eyebrow">Tu pedido</span>
            <h2 className="checkout-section-title">Resumen</h2>
            <div className="checkout-divider">
              <span className="checkout-divider-line" />
              <span className="checkout-divider-gem">✦</span>
              <span className="checkout-divider-line" />
            </div>

            <ul className="checkout-items">
              {items.map((item) => (
                <li key={item.id} className="checkout-item">
                  <span className="checkout-item-qty">{item.qty}×</span>
                  <span className="checkout-item-name">{item.nombre}</span>
                  <span className="checkout-item-price">{formatearPrecio(item.precio * item.qty)}</span>
                </li>
              ))}
            </ul>

            <div className="checkout-total-row">
              <span>Total</span>
              <span className="checkout-total-price">{formatearPrecio(total)}</span>
            </div>
          </section>

          {/* Formulario de domicilio */}
          <section className="checkout-form-section">
            <span className="checkout-eyebrow">Entrega</span>
            <h2 className="checkout-section-title">Datos del domicilio</h2>
            <div className="checkout-divider">
              <span className="checkout-divider-line" />
              <span className="checkout-divider-gem">✦</span>
              <span className="checkout-divider-line" />
            </div>

            <form className="checkout-form" onSubmit={handleSubmit}>
              <div className="checkout-field">
                <label htmlFor="checkout-nombre">Nombre completo</label>
                <input id="checkout-nombre" type="text" value={user.nombre} readOnly />
              </div>
              <div className="checkout-field">
                <label htmlFor="checkout-direccion">Dirección de entrega</label>
                <input
                  id="checkout-direccion"
                  type="text"
                  autoComplete="street-address"
                  placeholder="Calle 10 # 5-23, Apto 301"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  required
                />
              </div>
              <div className="checkout-field">
                <label htmlFor="checkout-telefono">Teléfono</label>
                <input
                  id="checkout-telefono"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="3000000000"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <div className="checkout-field">
                <label htmlFor="checkout-metodo">Método de pago</label>
                <select id="checkout-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)} required>
                  {Object.entries(METODOS).map(([valor, texto]) => (
                    <option key={valor} value={valor}>{texto}</option>
                  ))}
                </select>
              </div>
              <div className="checkout-field">
                <label htmlFor="checkout-notas">Notas adicionales</label>
                <textarea
                  id="checkout-notas"
                  placeholder="Instrucciones especiales para el domiciliario..."
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>

              {error && <p className="checkout-error" role="alert">{error}</p>}

              <button type="submit" className="checkout-submit-btn" disabled={enviando}>
                {enviando ? "Enviando pedido..." : "Confirmar pedido"}
              </button>
            </form>
          </section>

        </div>
      </main>

      {/* Modal de confirmación */}
      {confirmado && (
        <div className="checkout-modal-overlay" onClick={handleModalAccept}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-content">
              <span className="checkout-modal-icon">✓</span>
              <h2 className="checkout-modal-title">¡Pedido tomado con éxito!</h2>
              <p className="checkout-modal-text">Pronto estará en tus manos</p>
              <p className="checkout-modal-text">
                Total: {formatearPrecio(confirmado.total)} · {METODOS[confirmado.metodo]}
              </p>
              <button
                className="checkout-modal-btn"
                onClick={handleModalAccept}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default Checkout;
