import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Banknote, Check, CreditCard, Smartphone } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { formatearPrecio } from "../utils/formato";
import { crearPedido, crearPago } from "../services/pedidosService";
import { actualizarPerfil } from "../services/usuarioService";
import "./Checkout.css";

const METODOS = {
  efectivo: "Efectivo contra entrega",
  transferencia: "Transferencia / Nequi",
  tarjeta: "Tarjeta en puerta",
};

const ICONOS_METODO = { efectivo: Banknote, transferencia: Smartphone, tarjeta: CreditCard };

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
        (await crearPedido({
          items: items.map((i) => ({ menu_item_id: i.id, cantidad: i.qty })),
          direccion_pedido: direccion,
          observaciones: notas || undefined,
        }));
      setPedidoCreado(pedido);

      const pago = await crearPago(pedido.id, metodo);

      // El pedido no guarda teléfono: se guarda en el perfil para que el
      // restaurante pueda contactar al cliente y para rellenarlo la próxima vez.
      if (telefono !== user.celular || !user.direccion) {
        const perfil = await actualizarPerfil({ celular: telefono, direccion: user.direccion || direccion })
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
        <div className="contenedor entrada-pagina">
          <h1 className="checkout-title">Confirma tu pedido</h1>

          <div className="checkout-grid">
            {/* Formulario de domicilio */}
            <section className="checkout-form-section" aria-labelledby="checkout-entrega">
              <h2 id="checkout-entrega" className="checkout-section-title">Datos del domicilio</h2>

              <form id="checkout-form" className="checkout-form" onSubmit={handleSubmit}>
                <div className="campo">
                  <label htmlFor="checkout-nombre">Nombre completo</label>
                  <input id="checkout-nombre" type="text" value={user.nombre} readOnly />
                </div>
                <div className="campo">
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
                <div className="campo">
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

                <fieldset className="checkout-metodos">
                  <legend>Método de pago</legend>
                  {Object.entries(METODOS).map(([valor, texto]) => {
                    const Icono = ICONOS_METODO[valor];
                    return (
                      <label key={valor} className="checkout-metodo">
                        <input
                          type="radio"
                          name="metodo"
                          value={valor}
                          checked={metodo === valor}
                          onChange={() => setMetodo(valor)}
                        />
                        <Icono size={20} strokeWidth={1.7} aria-hidden="true" />
                        <span>{texto}</span>
                      </label>
                    );
                  })}
                </fieldset>

                <div className="campo">
                  <label htmlFor="checkout-notas">Notas adicionales</label>
                  <textarea
                    id="checkout-notas"
                    placeholder="Instrucciones especiales para el domiciliario..."
                    rows={3}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>
              </form>
            </section>

            {/* Resumen del pedido */}
            <aside className="checkout-summary tarjeta" aria-labelledby="checkout-resumen">
              <h2 id="checkout-resumen" className="checkout-section-title">Resumen</h2>

              <ul className="checkout-items">
                {items.map((item) => (
                  <li key={item.id} className="checkout-item">
                    {item.img ? (
                      <img src={item.img} alt="" className="checkout-item-img" />
                    ) : (
                      <span className="checkout-item-img" aria-hidden="true" />
                    )}
                    <span className="checkout-item-name">
                      {item.nombre}
                      <span className="checkout-item-qty">Cantidad: {item.qty}</span>
                    </span>
                    <span className="checkout-item-price">{formatearPrecio(item.precio * item.qty)}</span>
                  </li>
                ))}
              </ul>

              <div className="checkout-total-row">
                <span>Total</span>
                <span className="checkout-total-price">{formatearPrecio(total)}</span>
              </div>

              {error && <p className="aviso aviso--error" role="alert">{error}</p>}

              <button
                type="submit"
                form="checkout-form"
                className="boton boton--primario boton--ancho"
                disabled={enviando}
              >
                {enviando ? "Enviando pedido..." : "Confirmar pedido"}
              </button>
            </aside>
          </div>
        </div>
      </main>

      {/* Modal de confirmación */}
      {confirmado && (
        <div className="checkout-modal-overlay" onClick={handleModalAccept}>
          <div
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="checkout-modal-icon" aria-hidden="true">
              <Check size={30} strokeWidth={2.2} />
            </span>
            <h2 id="checkout-modal-titulo" className="checkout-modal-title">¡Pedido tomado con éxito!</h2>
            <p className="checkout-modal-text">Pronto estará en tus manos.</p>
            <dl className="checkout-modal-datos">
              <div>
                <dt>Total</dt>
                <dd>{formatearPrecio(confirmado.total)}</dd>
              </div>
              <div>
                <dt>Pago</dt>
                <dd>{METODOS[confirmado.metodo]}</dd>
              </div>
            </dl>
            <button type="button" className="boton boton--primario boton--ancho" onClick={handleModalAccept} autoFocus>
              Aceptar
            </button>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default Checkout;
