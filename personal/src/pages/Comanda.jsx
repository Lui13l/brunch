import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, Send, Trash2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/sesion";
import { useWebSocket } from "../hooks/useWebSocket";
import { Cabecera, Pantalla } from "../components/Layout";
import { Aviso, Boton, Cargando, Estado } from "../components/ui";
import { sonarMesaLista } from "../lib/aviso";
import { pesos, resumenDeMesa } from "../lib/formato";

const METODOS = [
  ["EFECTIVO", "Efectivo"],
  ["TARJETA", "Tarjeta"],
  ["TRANSFERENCIA", "Transferencia"],
];

// La cuenta de una mesa. No son tarjetas sueltas: es un documento con
// renglones, como la cuenta de papel que el cliente acaba viendo. Por eso van
// separados por filetes sobre una sola hoja, y el total manda al pie.
export default function Comanda() {
  const { id } = useParams();
  const { pedir, user } = useAuth();
  const navigate = useNavigate();

  const [comanda, setComanda] = useState(null);
  const [carta, setCarta] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [vista, setVista] = useState("cuenta"); // cuenta | carta | cobro

  const cargar = useCallback(async () => {
    try {
      setComanda(await pedir(`/api/comandas/${id}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [pedir, id]);

  useEffect(() => {
    cargar();
    pedir("/api/salon/menu").then(setCarta).catch((err) => setError(err.message));
  }, [cargar, pedir]);

  // Cuando cocina marca un plato listo, la cuenta se actualiza sola.
  const topics = useMemo(() => (user ? [`/topic/mesero/${user.id}/comandas`, "/topic/salon"] : []), [user]);
  useWebSocket("/ws", topics, (topic, mensaje) => {
    // Puede estar mirando esta misma cuenta cuando sale el último plato. El
    // aviso llega por dos temas; se suena solo con el del salón (una vez).
    if (topic === "/topic/salon" && mensaje?.tipo === "mesaCompleta" && String(mensaje.comandaId) === String(id)) {
      sonarMesaLista();
    }
    cargar();
  });

  const accion = async (ejecutar) => {
    setOcupado(true);
    setError("");
    try {
      await ejecutar();
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const agregar = (plato) =>
    accion(() =>
      pedir(`/api/comandas/${id}/items`, {
        method: "POST",
        body: JSON.stringify({ menuItemId: plato.id, cantidad: 1 }),
      }),
    );

  const cambiarCantidad = (item, delta) => {
    const cantidad = item.cantidad + delta;
    if (cantidad < 1) return accion(() => pedir(`/api/comandas/${id}/items/${item.id}`, { method: "DELETE" }));
    return accion(() =>
      pedir(`/api/comandas/${id}/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ cantidad }) }),
    );
  };

  const enviar = () =>
    accion(async () => {
      const r = await pedir(`/api/comandas/${id}/enviar`, { method: "POST" });
      if (r.faltantes.length > 0) {
        setAviso({
          tipo: "faltante",
          texto: `Enviado. Falta inventario de ${r.faltantes.map((f) => `${f.insumo} (${f.stock} ${f.unidad})`).join(", ")}`,
        });
      } else {
        setAviso({ tipo: "ok", texto: "Enviado a cocina" });
      }
      setVista("cuenta");
    });

  const cobrar = (metodoPago) =>
    accion(async () => {
      await pedir(`/api/comandas/${id}/cerrar`, { method: "POST", body: JSON.stringify({ metodoPago }) });
      navigate("/mesas");
    });

  if (!comanda) return <Pantalla>{error ? <Aviso onReintentar={cargar}>{error}</Aviso> : <Cargando />}</Pantalla>;

  const borradores = comanda.items.filter((i) => i.estado === "BORRADOR");
  const activos = comanda.items.filter((i) => i.estado !== "CANCELADO");

  return (
    <Pantalla>
      <Cabecera titulo={`Mesa ${comanda.mesaNumero}`} atras="/mesas" />
      <Aviso onReintentar={cargar}>{error}</Aviso>

      {aviso && (
        <div
          className={`flex items-start gap-3 px-4 py-3 font-bold ${
            aviso.tipo === "ok" ? "bg-listo text-white" : "bg-tibio text-tinta"
          }`}
        >
          <p className="flex-1">{aviso.texto}</p>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="shrink-0">
            <X size={18} />
          </button>
        </div>
      )}

      {resumenDeMesa(comanda).estado === "completa" && vista !== "carta" && (
        <p className="flex items-center gap-2 bg-listo px-4 py-3 text-lg font-extrabold text-white">
          <Check size={22} strokeWidth={3} />
          Todo listo para llevar
        </p>
      )}

      {vista === "carta" ? (
        <Carta carta={carta} onAgregar={agregar} onCerrar={() => setVista("cuenta")} ocupado={ocupado} />
      ) : (
        <div className="p-4">
          {activos.length === 0 ? (
            <p className="px-6 py-14 text-center text-lg text-tinta-2">
              La mesa está abierta. Agrega el primer plato.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl bg-mantel">
              {activos.map((item) => (
                <li key={item.id} className="border-b border-filete p-4 last:border-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-sala text-base font-extrabold text-tinta">
                      {item.cantidad}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] leading-snug font-bold text-tinta">{item.nombre}</p>
                      {item.notas && <p className="text-[15px] text-tinta-2">{item.notas}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Estado valor={item.estado} />
                        {item.faltoStock && <span className="text-[13px] font-bold text-brasa">sin inventario</span>}
                      </div>
                    </div>
                    <p className="text-[17px] font-extrabold text-tinta">{pesos(item.subtotal)}</p>
                  </div>

                  {(item.estado === "BORRADOR" || item.estado === "LISTO" ||
                    ["PENDIENTE", "PREPARANDO"].includes(item.estado)) && (
                    <div className="mt-3 flex items-center gap-2">
                      {item.estado === "BORRADOR" && (
                        <>
                          <button
                            onClick={() => cambiarCantidad(item, -1)}
                            disabled={ocupado}
                            aria-label={item.cantidad === 1 ? "Quitar plato" : "Restar uno"}
                            className="flex size-11 items-center justify-center rounded-lg border border-filete text-tinta active:bg-sala"
                          >
                            {item.cantidad === 1 ? <Trash2 size={18} /> : <Minus size={18} />}
                          </button>
                          <button
                            onClick={() => cambiarCantidad(item, 1)}
                            disabled={ocupado}
                            aria-label="Sumar uno"
                            className="flex size-11 items-center justify-center rounded-lg border border-filete text-tinta active:bg-sala"
                          >
                            <Plus size={18} />
                          </button>
                        </>
                      )}

                      <div className="flex-1" />

                      {item.estado === "LISTO" && (
                        <Boton
                          variante="marca"
                          disabled={ocupado}
                          onClick={() =>
                            accion(() => pedir(`/api/comandas/${id}/items/${item.id}/entregar`, { method: "POST" }))
                          }
                        >
                          Entregar
                        </Boton>
                      )}
                      {["PENDIENTE", "PREPARANDO"].includes(item.estado) && (
                        <Boton
                          variante="secundario"
                          disabled={ocupado}
                          onClick={() =>
                            accion(() => pedir(`/api/comandas/${id}/items/${item.id}/cancelar`, { method: "POST" }))
                          }
                        >
                          Cancelar
                        </Boton>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {vista === "cobro" && (
            <div className="mt-5 overflow-hidden rounded-xl bg-mantel">
              <p className="border-b border-filete px-4 py-3 text-lg font-extrabold text-tinta">¿Cómo pagan?</p>
              <div className="grid gap-2 p-4">
                {METODOS.map(([valor, etiqueta]) => (
                  <Boton key={valor} disabled={ocupado} onClick={() => cobrar(valor)}>
                    {etiqueta}
                  </Boton>
                ))}
                <Boton variante="secundario" onClick={() => setVista("cuenta")}>
                  Volver a la cuenta
                </Boton>
              </div>
            </div>
          )}
        </div>
      )}

      {vista !== "carta" && vista !== "cobro" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-filete bg-mantel px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-base font-semibold text-tinta-2">Total</span>
            <span className="text-3xl font-extrabold tracking-[-0.03em] text-tinta">{pesos(comanda.total)}</span>
          </div>
          <div className="flex gap-2">
            <Boton variante="secundario" className="flex-1" onClick={() => setVista("carta")}>
              Agregar platos
            </Boton>
            {borradores.length > 0 ? (
              <Boton className="flex-1" cargando={ocupado} onClick={enviar}>
                <span className="flex items-center justify-center gap-2">
                  <Send size={18} /> Enviar {borradores.length}
                </span>
              </Boton>
            ) : (
              <Boton
                variante="marca"
                className="flex-1"
                disabled={activos.length === 0}
                onClick={() => setVista("cobro")}
              >
                Cobrar
              </Boton>
            )}
          </div>
        </div>
      )}
    </Pantalla>
  );
}

function Carta({ carta, onAgregar, onCerrar, ocupado }) {
  const [categoria, setCategoria] = useState(null);
  const activa = carta.find((c) => c.id === categoria) ?? carta[0];

  return (
    <div className="p-4">
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {carta.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoria(c.id)}
            className={`min-h-11 shrink-0 rounded-lg px-4 font-bold transition ${
              activa?.id === c.id ? "bg-tinta text-white" : "border border-filete bg-mantel text-tinta"
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      <ul className="overflow-hidden rounded-xl bg-mantel">
        {(activa?.items ?? []).map((plato) => (
          <li key={plato.id} className="border-b border-filete last:border-0">
            <button
              disabled={ocupado}
              onClick={() => onAgregar(plato)}
              className="flex w-full items-center gap-3 p-4 text-left active:bg-sala disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-tinta">{plato.nombre}</p>
                <p className="text-[15px] font-semibold text-tinta-2">{pesos(plato.precio)}</p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tinta text-white">
                <Plus size={20} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-filete bg-mantel px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Boton className="w-full" onClick={onCerrar}>
          Volver a la cuenta
        </Boton>
      </div>
    </div>
  );
}
