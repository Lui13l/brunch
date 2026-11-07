import { useCallback, useState } from "react";
import * as svc from "../../services/adminService";
import { Aviso, Campo, Cargando, Chip, Encabezado, Selector, Vacio } from "./comun";
import { codigo, useCarga } from "./util";

const ESTADOS = {
  pendiente: { texto: "Pendiente", tono: "alerta" },
  confirmada: { texto: "Confirmada", tono: "info" },
  finalizada: { texto: "Finalizada", tono: "ok" },
  cancelada: { texto: "Cancelada", tono: "apagado" },
};
// Lo que permite el backend desde cada estado.
const SIGUIENTES = {
  pendiente: ["confirmada", "cancelada"],
  confirmada: ["finalizada", "cancelada"],
  finalizada: [],
  cancelada: [],
};
const ACCION = { confirmada: "Confirmar", finalizada: "Finalizar", cancelada: "Cancelar" };

const fechaDia = (d) =>
  d ? new Date(d).toLocaleDateString("es-CO", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";

export default function AdminReservas() {
  const [filtro, setFiltro] = useState({ estado: "", fecha: "" });
  const [ocupado, setOcupado] = useState(null);
  const cargar = useCallback(() => svc.listarReservas(filtro), [filtro]);
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);
  const reservas = datos ?? [];

  const cambiar = async (r, estado) => {
    if (estado === "cancelada" && !window.confirm("¿Cancelar esta reserva?")) return;
    setOcupado(r._id);
    try {
      await svc.cambiarEstadoReserva(r._id, estado);
      await recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      <Encabezado titulo="Reservas" descripcion="Reservas hechas desde la web, ordenadas por día y hora." />

      <div className="adm-filtros">
        <Selector
          etiqueta="Estado"
          opciones={[{ valor: "", texto: "Todas" }, ...Object.entries(ESTADOS).map(([valor, e]) => ({ valor, texto: e.texto }))]}
          value={filtro.estado}
          onChange={(v) => setFiltro({ ...filtro, estado: v })}
        />
        <Campo etiqueta="Día">
          <input className="input" type="date" value={filtro.fecha} onChange={(e) => setFiltro({ ...filtro, fecha: e.target.value })} />
        </Campo>
      </div>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && reservas.length === 0 && <Vacio>No hay reservas con estos filtros.</Vacio>}

      <ul className="adm-lista">
        {reservas.map((r) => {
          const e = ESTADOS[r.estado_reserva] ?? { texto: r.estado_reserva, tono: "neutro" };
          return (
            <li key={r._id} className="adm-tarjeta">
              <div className="adm-tarjeta-cabeza">
                <span className="adm-tarjeta-titulo">{fechaDia(r.dia)} · {r.hora}</span>
                <Chip tono={e.tono}>{e.texto}</Chip>
                <span className="adm-tarjeta-meta">{codigo(r._id)}</span>
              </div>
              <p>
                <strong>{r.usuario_id?.nombre ?? "Cliente"}</strong> · {r.cupo} persona{r.cupo === 1 ? "" : "s"}
                {r.usuario_id?.celular && <> · <a href={`tel:${r.usuario_id.celular}`}>{r.usuario_id.celular}</a></>}
              </p>
              {r.ocasion && <p className="adm-tarjeta-meta">Ocasión: {r.ocasion}</p>}
              {r.detalles && <p><em>{r.detalles}</em></p>}
              {SIGUIENTES[r.estado_reserva]?.length > 0 && (
                <div className="adm-tarjeta-acciones">
                  {SIGUIENTES[r.estado_reserva].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`button${s === "cancelada" ? "" : " adm-cafe"}${ocupado === r._id ? " is-loading" : ""}`}
                      disabled={ocupado === r._id}
                      onClick={() => cambiar(r, s)}
                    >
                      {ACCION[s]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
