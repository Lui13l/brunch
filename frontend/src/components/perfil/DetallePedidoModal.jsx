import { X } from "lucide-react";
import { codigoCorto as codigoPedido, formatearFecha, formatearPrecio } from "../../utils/formato";

export default function DetallePedidoModal({ pedido, cargando, error, onCerrar }) {
  if (!pedido) return null;

  return (
    <div className="perfil-modal-backdrop" onClick={onCerrar}>
      <section
        className="perfil-order-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pedido-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="perfil-modal-header">
          <h2 id="pedido-detail-title" className="perfil-title">Pedido {codigoPedido(pedido._id)}</h2>
          <button type="button" className="perfil-modal-close" onClick={onCerrar} aria-label="Cerrar detalles">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {error && <p className="aviso aviso--error" role="alert">{error}</p>}
        {cargando ? (
          <p className="perfil-history-status" role="status">Cargando detalles...</p>
        ) : (
          <>
            <dl className="perfil-order-meta">
              <div>
                <dt>Fecha</dt>
                <dd>{formatearFecha(pedido.createdAt || pedido.fecha_inicio)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{String(pedido.estado || "").replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt>Dirección</dt>
                <dd>{pedido.direccion_pedido || "No especificada"}</dd>
              </div>
              {pedido.observaciones && (
                <div>
                  <dt>Notas</dt>
                  <dd>{pedido.observaciones}</dd>
                </div>
              )}
            </dl>
            <ul className="perfil-order-items">
              {(pedido.items || []).map((item, index) => (
                <li key={`${item.menu_item_id || item.nombre}-${index}`}>
                  <span>{item.cantidad}× {item.nombre}</span>
                  <span>{formatearPrecio(item.subtotal)}</span>
                </li>
              ))}
              <li className="perfil-order-total">
                <strong>Total</strong>
                <strong>{formatearPrecio(pedido.total)}</strong>
              </li>
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
