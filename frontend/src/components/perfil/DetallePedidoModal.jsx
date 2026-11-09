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
          <div>
            <span className="perfil-eyebrow">Detalle del pedido</span>
            <h2 id="pedido-detail-title" className="perfil-title">{codigoPedido(pedido._id)}</h2>
          </div>
          <button type="button" className="perfil-modal-close" onClick={onCerrar} aria-label="Cerrar detalles">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {error && <p className="perfil-error" role="alert">{error}</p>}
        {cargando ? (
          <p className="perfil-history-status" role="status">Cargando detalles...</p>
        ) : (
          <>
            <p className="perfil-order-meta">Fecha: {formatearFecha(pedido.createdAt || pedido.fecha_inicio)}</p>
            <p className="perfil-order-meta">Estado: {pedido.estado}</p>
            <p className="perfil-order-meta">Dirección: {pedido.direccion_pedido || "No especificada"}</p>
            {pedido.observaciones && <p className="perfil-order-meta">Notas: {pedido.observaciones}</p>}
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
