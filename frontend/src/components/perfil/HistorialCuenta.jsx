import { Fragment, useState } from "react";
import { codigoCorto as codigoPedido, formatearFecha, formatearPrecio } from "../../utils/formato";

// "Confirmada" -> "confirmada": define el color de la etiqueta de estado.
const claseEstado = (estado) => String(estado || "").toLowerCase().replace(/[^a-z]+/g, "-");

const EncabezadoHistorial = ({ id, titulo, subtitulo }) => (
  <>
    <h1 id={id} className="perfil-title">{titulo}</h1>
    <p className="perfil-subtitle">{subtitulo}</p>
  </>
);

export function HistorialPedidos({ pedidos, cargando, error, onVerDetalle }) {
  return (
    <section className="perfil-card perfil-history" aria-labelledby="pedidos-title">
      <EncabezadoHistorial id="pedidos-title" titulo="Mis pedidos" subtitulo="Consulta tus pedidos anteriores y sus detalles." />
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
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

function FilaReserva({ reserva, onCancelar, cancelandoId, onEditar, guardandoId }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(() => ({
    dia: reserva.dia.slice(0, 10),
    hora: reserva.hora,
    cupo: String(reserva.cupo),
  }));
  const editable = ["pendiente", "confirmada"].includes(reserva.estado_reserva);

  const guardar = async (event) => {
    event.preventDefault();
    const guardada = await onEditar(reserva._id, { ...form, cupo: Number(form.cupo) });
    if (guardada) setEditando(false);
  };

  return (
    <Fragment>
      <tr>
        <td data-label="Fecha">{formatearFecha(reserva.dia, true)}</td>
        <td data-label="Hora">{reserva.hora}</td>
        <td data-label="Personas">{reserva.cupo}</td>
        <td data-label="Ocasión">{reserva.ocasion || "—"}</td>
        <td data-label="Estado">
          <span className={`perfil-estado perfil-estado--${claseEstado(reserva.estado_reserva)}`}>
            {reserva.estado_reserva}
          </span>
        </td>
        <td data-label="Acciones">
          {editable && (
            <div className="perfil-reserva-acciones">
              <button
                type="button"
                className="perfil-detail-link"
                onClick={() => setEditando((actual) => !actual)}
                disabled={guardandoId === reserva._id || cancelandoId === reserva._id}
              >
                {editando ? "Cerrar edición" : "Editar"}
              </button>
              <button
                type="button"
                className="perfil-detail-link perfil-cancel-link"
                disabled={cancelandoId === reserva._id || guardandoId === reserva._id}
                onClick={() => onCancelar(reserva)}
              >
                {cancelandoId === reserva._id ? "Cancelando..." : "Cancelar"}
              </button>
            </div>
          )}
        </td>
      </tr>
      {editando && editable && (
        <tr>
          <td colSpan={6}>
            <form className="perfil-reserva-edicion" onSubmit={guardar}>
              <label>
                Fecha
                <input
                  className="input"
                  type="date"
                  required
                  value={form.dia}
                  onChange={(event) => setForm((actual) => ({ ...actual, dia: event.target.value }))}
                />
              </label>
              <label>
                Hora
                <input
                  className="input"
                  type="time"
                  required
                  value={form.hora}
                  onChange={(event) => setForm((actual) => ({ ...actual, hora: event.target.value }))}
                />
              </label>
              <label>
                Personas
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  required
                  value={form.cupo}
                  onChange={(event) => setForm((actual) => ({ ...actual, cupo: event.target.value }))}
                />
              </label>
              <div className="perfil-reserva-edicion-acciones">
                <button type="submit" className="boton boton--primario" disabled={guardandoId === reserva._id}>
                  {guardandoId === reserva._id ? "Guardando..." : "Guardar cambios"}
                </button>
                <button type="button" className="perfil-detail-link" onClick={() => setEditando(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function HistorialReservas({ reservas, cargando, error, onCancelar, cancelandoId, onEditar, guardandoId }) {
  return (
    <section className="perfil-card perfil-history" aria-labelledby="reservas-title">
      <EncabezadoHistorial id="reservas-title" titulo="Mis reservas" subtitulo="Consulta tus reservas." />
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
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
                <th><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((reserva) => (
                <FilaReserva
                  key={reserva._id}
                  reserva={reserva}
                  onCancelar={onCancelar}
                  cancelandoId={cancelandoId}
                  onEditar={onEditar}
                  guardandoId={guardandoId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
