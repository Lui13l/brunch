import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Link2, Minus, Plus, Send, Trash2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/sesion";
import { useWebSocket } from "../hooks/useWebSocket";
import { Cabecera, Pantalla } from "../components/Layout";
import { Aviso, Boton, Cargando } from "../components/ui";
import Carta from "../components/comanda/Carta";
import Cobro from "../components/comanda/Cobro";
import MesasDeLaCuenta from "../components/comanda/MesasDeLaCuenta";
import { sonarMesaLista } from "../lib/aviso";
import { EN_COCINA, pesos, resumenDeMesa, tituloDeMesas } from "../lib/formato";

// Los platos de la cuenta, agrupados por lo que hay que hacer con ellos. El
// orden es el del trabajo del mesero: primero lo que aún no ha mandado, luego
// lo que espera de cocina, lo que ya puede llevar y, al final, lo entregado.
const SECCIONES = [
  { clave: "porEnviar", titulo: "Por enviar", estados: ["BORRADOR"] },
  { clave: "enCocina", titulo: "En cocina", estados: EN_COCINA },
  { clave: "listos", titulo: "Listos para llevar", estados: ["LISTO"] },
  { clave: "entregados", titulo: "Entregados", estados: ["ENTREGADO"] },
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
  const [eligiendoMesas, setEligiendoMesas] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setComanda(await pedir(`/api/comandas/${id}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [pedir, id]);

  const cargarCarta = useCallback(
    () => pedir("/api/salon/menu").then(setCarta).catch((err) => setError(err.message)),
    [pedir],
  );

  useEffect(() => {
    cargar();
    cargarCarta();
  }, [cargar, cargarCarta]);

  // Cuando cocina marca un plato listo, la cuenta se actualiza sola.
  const topics = useMemo(() => (user ? [`/topic/mesero/${user.id}/comandas`, "/topic/salon"] : []), [user]);
  useWebSocket("/ws", topics, (topic, mensaje) => {
    // Cambió el inventario: un plato pudo quedar agotado o volver a estar disponible.
    if (mensaje?.tipo === "carta") {
      cargarCarta();
      return;
    }
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
      // La cuenta pudo cambiar a medias (por ejemplo, al quitar varios platos).
      cargar();
    } finally {
      setOcupado(false);
    }
  };

  const cambiarCantidad = (item, delta) => {
    const cantidad = item.cantidad + delta;
    if (cantidad < 1) return accion(() => pedir(`/api/comandas/${id}/items/${item.id}`, { method: "DELETE" }));
    return accion(() =>
      pedir(`/api/comandas/${id}/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ cantidad }) }),
    );
  };

  // Lo que está por enviar de un plato, sin notas: ahí se suman y se restan
  // las unidades que se piden desde la carta.
  const borradorDe = (plato) =>
    comanda.items.findLast((i) => i.estado === "BORRADOR" && i.menuItemId === plato.id && !i.notas);

  // Pedir otra vez el mismo plato sube su cantidad: tres cafés son un renglón
  // con un 3, no tres renglones. La carta no deja agregar un plato agotado.
  const agregar = (plato) => {
    const existente = borradorDe(plato);
    if (existente) return cambiarCantidad(existente, 1);
    return accion(async () => {
      await pedir(`/api/comandas/${id}/items`, {
        method: "POST",
        body: JSON.stringify({ menuItemId: plato.id, cantidad: 1 }),
      });
      setAviso(null);
    });
  };

  const quitarUno = (plato) => {
    const item =
      borradorDe(plato) ?? comanda.items.findLast((i) => i.estado === "BORRADOR" && i.menuItemId === plato.id);
    if (item) cambiarCantidad(item, -1);
  };

  // `seguirEn`: a qué vista volver después de enviar (desde el cobro se sigue cobrando).
  const enviar = (seguirEn = "cuenta") =>
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
      setVista(seguirEn);
    });

  const quitarBorradores = () =>
    accion(async () => {
      for (const item of comanda.items.filter((i) => i.estado === "BORRADOR")) {
        await pedir(`/api/comandas/${id}/items/${item.id}`, { method: "DELETE" });
      }
    });

  // `cobro` es { metodoPago, forzar } o, si la cuenta se dividió, { pagos, forzar }.
  const cobrar = (cobro) =>
    accion(async () => {
      await pedir(`/api/comandas/${id}/cerrar`, { method: "POST", body: JSON.stringify(cobro) });
      navigate("/mesas");
    });

  const anular = () =>
    accion(async () => {
      await pedir(`/api/comandas/${id}/anular`, { method: "POST" });
      navigate("/mesas");
    });

  const entregar = (items) =>
    accion(async () => {
      for (const item of items) {
        await pedir(`/api/comandas/${id}/items/${item.id}/entregar`, { method: "POST" });
      }
    });

  const cancelar = (item) => {
    if (!window.confirm(`¿Cancelar ${item.nombre}? Cocina dejará de prepararlo.`)) return;
    accion(() => pedir(`/api/comandas/${id}/items/${item.id}/cancelar`, { method: "POST" }));
  };

  if (!comanda) return <Pantalla>{error ? <Aviso onReintentar={cargar}>{error}</Aviso> : <Cargando />}</Pantalla>;

  const borradores = comanda.items.filter((i) => i.estado === "BORRADOR");
  const activos = comanda.items.filter((i) => i.estado !== "CANCELADO");
  const secciones = SECCIONES.map((s) => ({
    ...s,
    items: comanda.items.filter((i) => s.estados.includes(i.estado)),
  })).filter((s) => s.items.length > 0);

  // Cuántas unidades de cada plato esperan en borrador: la carta lo muestra al lado.
  const enCuenta = new Map();
  for (const item of borradores) enCuenta.set(item.menuItemId, (enCuenta.get(item.menuItemId) ?? 0) + item.cantidad);

  // A un plato agotado tampoco se le suman unidades desde la cuenta.
  const agotados = new Set(carta.flatMap((c) => c.items).filter((p) => p.agotado).map((p) => p.id));

  return (
    <Pantalla>
      <Cabecera
        titulo={tituloDeMesas(comanda)}
        atras="/mesas"
        acciones={
          <button
            onClick={() => setEligiendoMesas(true)}
            title="Juntar o soltar mesas"
            className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white/15 px-3 text-[15px] font-bold text-white active:bg-white/25"
          >
            <Link2 size={18} aria-hidden />
            Mesas
          </button>
        }
      />
      <Aviso onReintentar={cargar}>{error}</Aviso>

      {aviso && (
        <div
          role="status"
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

      {resumenDeMesa(comanda).estado === "completa" && vista === "cuenta" && (
        <p className="flex items-center gap-2 bg-listo px-4 py-3 text-lg font-extrabold text-white">
          <Check size={22} strokeWidth={3} />
          Todo listo para llevar
        </p>
      )}

      {vista === "carta" && (
        <Carta
          carta={carta}
          enCuenta={enCuenta}
          onAgregar={agregar}
          onQuitar={quitarUno}
          onCerrar={() => setVista("cuenta")}
          onCobrar={() => setVista("cobro")}
          ocupado={ocupado}
        />
      )}

      {vista === "cobro" && (
        <Cobro
          comanda={comanda}
          esAdmin={user?.rol === "ADMIN"}
          ocupado={ocupado}
          onEnviar={() => enviar("cobro")}
          onQuitarBorradores={quitarBorradores}
          onCobrar={cobrar}
          onAnular={anular}
          onVolver={() => setVista("cuenta")}
        />
      )}

      {vista === "cuenta" && (
        <div className="space-y-5 p-4 pb-40">
          {activos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-filete px-6 py-14 text-center">
              <p className="font-titulo text-2xl font-semibold tracking-[-0.02em] text-tinta">La mesa está abierta</p>
              <p className="mt-1 text-lg text-tinta-2">Agrega el primer plato de la cuenta.</p>
            </div>
          ) : (
            secciones.map((seccion) => (
              <section key={seccion.clave} aria-label={seccion.titulo}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="flex items-baseline gap-2 font-titulo text-2xl font-semibold tracking-[-0.02em] text-tinta">
                    {seccion.titulo}
                    <span className="font-sans text-lg font-bold text-tinta-2 tabular-nums">{seccion.items.length}</span>
                  </h2>
                  {seccion.clave === "listos" && seccion.items.length > 1 && (
                    <Boton variante="marca" disabled={ocupado} onClick={() => entregar(seccion.items)}>
                      Entregar todos
                    </Boton>
                  )}
                </div>

                <ul
                  className={`overflow-hidden rounded-2xl border bg-mantel ${
                    seccion.clave === "listos" ? "border-listo" : "border-filete"
                  } ${seccion.clave === "entregados" ? "opacity-70" : ""}`}
                >
                  {seccion.items.map((item) => (
                    <Renglon
                      key={item.id}
                      item={item}
                      ocupado={ocupado}
                      agotado={agotados.has(item.menuItemId)}
                      onCantidad={(delta) => cambiarCantidad(item, delta)}
                      onEntregar={() => entregar([item])}
                      onCancelar={() => cancelar(item)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      {vista === "cuenta" && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-filete bg-mantel px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-base font-semibold text-tinta-2">Total</span>
            <span className="font-titulo text-4xl leading-none font-semibold tracking-[-0.03em] text-tinta tabular-nums">
              {pesos(comanda.total)}
            </span>
          </div>
          <div className="flex gap-2">
            <Boton variante="secundario" className="flex-1" onClick={() => setVista("carta")}>
              <span className="flex items-center justify-center gap-2">
                <Plus size={18} /> Agregar platos
              </span>
            </Boton>
            {borradores.length > 0 ? (
              <Boton className="flex-1" cargando={ocupado} onClick={() => enviar()}>
                <span className="flex items-center justify-center gap-2">
                  <Send size={18} /> Enviar a cocina ({borradores.length})
                </span>
              </Boton>
            ) : (
              <Boton variante="marca" className="flex-1" onClick={() => setVista("cobro")}>
                {activos.length === 0 ? "Cerrar mesa" : "Cobrar"}
              </Boton>
            )}
          </div>
        </div>
      )}

      {eligiendoMesas && (
        <MesasDeLaCuenta
          comanda={comanda}
          onCerrar={() => setEligiendoMesas(false)}
          onGuardado={() => {
            setEligiendoMesas(false);
            cargar();
          }}
        />
      )}
    </Pantalla>
  );
}

// Un plato de la cuenta. Lo que se puede hacer con él depende de dónde está:
// en borrador se cambia la cantidad, en cocina se cancela y listo se entrega.
function Renglon({ item, ocupado, agotado, onCantidad, onEntregar, onCancelar }) {
  const borrador = item.estado === "BORRADOR";
  const enCocina = EN_COCINA.includes(item.estado);

  return (
    <li className="border-b border-filete p-4 last:border-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sala text-lg font-extrabold text-tinta tabular-nums">
          {item.cantidad}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] leading-snug font-bold text-tinta">{item.nombre}</p>
          {item.notas && <p className="text-[15px] text-tinta-2">{item.notas}</p>}
          {item.estado === "PREPARANDO" && <p className="text-[14px] font-bold text-caramelo">Ya lo están preparando</p>}
          {item.faltoStock && <p className="text-[14px] font-bold text-brasa">Se envió sin inventario suficiente</p>}
        </div>
        <p className="shrink-0 text-[18px] font-extrabold text-tinta tabular-nums">{pesos(item.subtotal)}</p>
      </div>

      {(borrador || enCocina || item.estado === "LISTO") && (
        <div className="mt-3 flex items-center gap-2">
          {borrador && (
            <>
              <button
                onClick={() => onCantidad(-1)}
                disabled={ocupado}
                aria-label={item.cantidad === 1 ? `Quitar ${item.nombre}` : "Restar uno"}
                className="flex size-12 items-center justify-center rounded-lg border border-filete text-tinta active:bg-sala disabled:opacity-50"
              >
                {item.cantidad === 1 ? <Trash2 size={20} /> : <Minus size={20} />}
              </button>
              <button
                onClick={() => onCantidad(1)}
                disabled={ocupado || agotado}
                aria-label="Sumar uno"
                title={agotado ? "Agotado: falta inventario" : undefined}
                className="flex size-12 items-center justify-center rounded-lg border border-filete text-tinta active:bg-sala disabled:opacity-50"
              >
                <Plus size={20} />
              </button>
              {agotado && <span className="text-[14px] font-bold text-brasa">Agotado</span>}
            </>
          )}

          <div className="flex-1" />

          {item.estado === "LISTO" && (
            <Boton variante="marca" disabled={ocupado} onClick={onEntregar}>
              Entregar
            </Boton>
          )}
          {enCocina && (
            <Boton variante="secundario" disabled={ocupado} onClick={onCancelar}>
              Cancelar plato
            </Boton>
          )}
        </div>
      )}
    </li>
  );
}
