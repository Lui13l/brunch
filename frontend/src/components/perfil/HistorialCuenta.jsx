import { codigoCorto as codigoPedido, formatearFecha, formatearPrecio } from "../../utils/formato";

const EncabezadoHistorial = ({ id, titulo, subtitulo }) => (
  <>
    <span className="perfil-eyebrow">Tu cuenta</span>
    <h1 id={id} className="perfil-title">{titulo}</h1>
    <p className="perfil-subtitle">{subtitulo}</p>
  </>
);

export function HistorialPedidos({ pedidos, cargando, error, onVerDetalle }) {
  return (
    <section className="perfil-card perfil-history" aria-labelledby="pedidos-title">
      <EncabezadoHistorial id="pedidos-title" titulo="Mis pedidos" subtitulo="Consulta tus pedidos anteriores y sus detalles." />
      {error && <p className="perfil-error" role="alert">{error}</p>}
      {cargando ? (
        <p className="perfil-history-status" role="status">Cargando tus pedidos...</p>
      ) : error ? null : pedidos.length === 0 ? (
        <p className="perfil-history-status">Todavía no tienes pedidos.</p>
      ) : (
        <div className="perfil-table-wrap">
          <table className="perfil-orders-table">
            <thead>
              <tr>
                <th>Número del pedido</th>
                <th>Detalles del pedido</th>
                <th>Dirección</th>
                <th>Valor total</th>
                <th><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido._id}>
                  <td data-label="Número del pedido">{codigoPedido(pedido._id)}</td>
                  <td data-label="Detalles del pedido">
                    {(pedido.items || []).map((item) => `${item.cantidad}× ${item.nombre}`).join(", ")}
                  </td>
                  <td data-label="Dirección">{pedido.direccion_pedido || "No especificada"}</td>
                  <td data-label="Valor total">{formatearPrecio(pedido.total)}</td>
                  <td data-label="Acciones">
                    <button
                      type="button"
                      className="perfil-detail-link"
                      onClick={() => onVerDetalle(pedido)}
                    >
                      Detalles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function HistorialReservas({ reservas, cargando, error }) {
  return (
    <section className="perfil-card perfil-history" aria-labelledby="reservas-title">
      <EncabezadoHistorial id="reservas-title" titulo="Mis reservas" subtitulo="Consulta tus reservas." />
      {error && <p className="perfil-error" role="alert">{error}</p>}
      {cargando ? (
        <p className="perfil-history-status" role="status">Cargando tus reservas...</p>
      ) : error ? null : reservas.length === 0 ? (
        <p className="perfil-history-status">Todavía no tienes reservas.</p>
      ) : (
        <div className="perfil-table-wrap">
          <table className="perfil-orders-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Personas</th>
                <th>Ocasión</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((reserva) => (
                <tr key={reserva._id}>
                  <td data-label="Fecha">{formatearFecha(reserva.dia, true)}</td>
                  <td data-label="Hora">{reserva.hora}</td>
                  <td data-label="Personas">{reserva.cupo}</td>
                  <td data-label="Ocasión">{reserva.ocasion || "—"}</td>
                  <td data-label="Estado">{reserva.estado_reserva}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
