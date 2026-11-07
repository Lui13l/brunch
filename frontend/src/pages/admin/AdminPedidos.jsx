import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import * as svc from "../../services/adminService";
import { Aviso, Cargando, Chip, Encabezado, RangoFechas, Selector, Vacio } from "./comun";
import { codigo, fechaHora, hoy, pesos, useCarga } from "./util";

const ESTADOS = {
  pendiente: { texto: "Por confirmar", tono: "alerta" },
  confirmado: { texto: "Confirmado", tono: "info" },
  preparando: { texto: "Preparando", tono: "proceso" },
  en_camino: { texto: "En camino", tono: "ok" },
  entregado: { texto: "Entregado", tono: "neutro" },
  cancelado: { texto: "Cancelado", tono: "apagado" },
};
const ACCION = {
  confirmado: "Confirmar",
  preparando: "Empezar a preparar",
  en_camino: "Despachar",
  entregado: "Marcar entregado",
};
const FILTRO_ESTADO = [{ valor: "", texto: "Todos" }, ...Object.entries(ESTADOS).map(([valor, e]) => ({ valor, texto: e.texto }))];

export default function AdminPedidos() {
  const [vista, setVista] = useState("activos");
  const [rango, setRango] = useState({ desde: hoy(), hasta: hoy() });
  const [estado, setEstado] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(
    () =>
      Promise.all([
        svc.listarPedidos(vista === "activos" ? { activos: "true" } : { ...rango, estado }),
        svc.listarDomiciliarios({ estado: "disponible" }),
      ]),
    [vista, rango, estado],
  );
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);
  const [pedidos, disponibles] = datos ?? [[], []];

  const ejecutar = async (id, accion, mensaje) => {
    setOcupado(id);
    setError("");
    setAviso("");
    try {
      await accion();
      setAviso(mensaje);
      await recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  };

  const cambiarEstado = (p, nuevo) => {
    if (nuevo === "cancelado" && !window.confirm(`¿Cancelar el pedido ${codigo(p.id)}?`)) return;
    ejecutar(p.id, () => svc.cambiarEstadoPedido(p.id, nuevo), `Pedido ${codigo(p.id)}: ${ESTADOS[nuevo].texto}.`);
  };

  return (
    <>
      <Encabezado titulo="Pedidos" descripcion="Pedidos a domicilio de la web: estado, domiciliario e historial.">
        <button type="button" className="button" onClick={recargar} disabled={cargando}>
          <RefreshCw size={16} />
          <span>&nbsp;Actualizar</span>
        </button>
      </Encabezado>

      <div className="adm-tabs">
        {[
          ["activos", "Activos"],
          ["historial", "Historial"],
        ].map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            className={`button${vista === clave ? " is-selected" : ""}`}
            onClick={() => setVista(clave)}
          >
            {texto}
          </button>
        ))}
      </div>

      {vista === "historial" && (
        <div className="adm-filtros">
          <RangoFechas rango={rango} onCambiar={setRango} />
          <Selector etiqueta="Estado" opciones={FILTRO_ESTADO} value={estado} onChange={setEstado} />
        </div>
      )}

      <Aviso tipo="ok" onCerrar={() => setAviso("")}>{aviso}</Aviso>
      <Aviso>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && pedidos.length === 0 && (
        <Vacio>{vista === "activos" ? "No hay pedidos activos." : "No hubo pedidos en este rango."}</Vacio>
      )}

      <ul className="adm-lista">
        {pedidos.map((p) => {
          const e = ESTADOS[p.estado] ?? { texto: p.estado, tono: "neutro" };
          const avance = (p.siguientes ?? []).filter((s) => s !== "cancelado");
          const puedeAsignar = !["entregado", "cancelado"].includes(p.estado);
          return (
            <li key={p.id} className="adm-tarjeta">
              <div className="adm-tarjeta-cabeza">
                <span className="adm-tarjeta-titulo">{codigo(p.id)}</span>
                <Chip tono={e.tono}>{e.texto}</Chip>
                <span className="adm-tarjeta-meta">{fechaHora(p.fechaInicio)}</span>
              </div>
              <p>
                <strong>{p.cliente?.nombre ?? "Cliente"}</strong>
                {p.cliente?.celular && <> · <a href={`tel:${p.cliente.celular}`}>{p.cliente.celular}</a></>}
                {p.cliente?.correo && <span className="adm-tarjeta-meta"> · {p.cliente.correo}</span>}
              </p>
              {p.direccion && <p className="adm-tarjeta-meta">{p.direccion}</p>}
              {p.fechaProgramada && <p className="adm-tarjeta-meta">Programado: {fechaHora(p.fechaProgramada)}</p>}
              {p.observaciones && <p><em>{p.observaciones}</em></p>}
              <ul className="adm-items">
                {p.items.map((i, n) => (
                  <li key={`${i.menuItemId}-${n}`}>
                    <span>{i.cantidad}× {i.nombre}</span>
                    <span>{pesos(i.subtotal)}</span>
                  </li>
                ))}
                <li>
                  <strong>Total</strong>
                  <strong>{pesos(p.total)}</strong>
                </li>
              </ul>
              <p className="adm-tarjeta-meta">
                {p.domiciliario ? `Domiciliario: ${p.domiciliario.nombre}` : "Sin domiciliario"} ·{" "}
                {p.pagoId ? "Pago registrado" : "Sin pago"}
              </p>

              <div className="adm-tarjeta-acciones">
                {avance.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`button adm-cafe${ocupado === p.id ? " is-loading" : ""}`}
                    disabled={ocupado === p.id}
                    onClick={() => cambiarEstado(p, s)}
                  >
                    {ACCION[s] ?? s}
                  </button>
                ))}
                {(p.siguientes ?? []).includes("cancelado") && (
                  <button type="button" className="button" disabled={ocupado === p.id} onClick={() => cambiarEstado(p, "cancelado")}>
                    Cancelar
                  </button>
                )}
                {puedeAsignar && disponibles.length > 0 && (
                  <div className="select">
                    <select
                      aria-label={`Asignar domiciliario al pedido ${codigo(p.id)}`}
                      value=""
                      disabled={ocupado === p.id}
                      onChange={(ev) =>
                        ev.target.value &&
                        ejecutar(p.id, () => svc.asignarDomiciliario(p.id, ev.target.value), "Domiciliario asignado.")
                      }
                    >
                      <option value="">Asignar domiciliario…</option>
                      {disponibles.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.nombre} {d.apellido}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
