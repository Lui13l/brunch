import { useCallback, useEffect, useRef, useState } from "react";
import { Bike, Phone, Plus } from "lucide-react";
import { Aviso, Boton, Campo, Cargando, Estado, Hoja, RangoFechas, Selector, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  ACCION_PEDIDO,
  COLOR_PEDIDO,
  ETIQUETA_PEDIDO,
  ORDEN_PEDIDO,
  PIEL_ESPERA,
  codigoCorto,
  fechaHora,
  hoyISO,
  minutosDesde,
  nivelDeEspera,
  pesos,
} from "../../lib/formato";

const TOPICS = ["/topic/admin/pedidos", "/topic/admin/pedidos/estado"];
const PESTANAS = [
  { clave: "activos", texto: "Activos" },
  { clave: "historial", texto: "Historial" },
];
const OPCIONES_ESTADO = [{ valor: "", texto: "Todos" }, ...ORDEN_PEDIDO.map((e) => ({ valor: e, texto: ETIQUETA_PEDIDO[e] }))];
const RESALTE_MS = 15_000;

const ordenar = (lista, pestana) =>
  [...lista].sort((a, b) =>
    pestana === "activos"
      ? ORDEN_PEDIDO.indexOf(a.estado) - ORDEN_PEDIDO.indexOf(b.estado) ||
        (a.fechaInicio ?? "").localeCompare(b.fechaInicio ?? "")
      : (b.fechaInicio ?? "").localeCompare(a.fechaInicio ?? ""),
  );

// Pedidos a domicilio de la web, en vivo: los nuevos aparecen solos y el
// estado se cambia desde aquí con los botones que el servidor permite.
export default function Pedidos() {
  const { pedir } = useAuth();
  const [pestana, setPestana] = useState("activos");
  const [rango, setRango] = useState({ desde: hoyISO(), hasta: hoyISO() });
  const [filtroEstado, setFiltroEstado] = useState("");
  const [pedidos, setPedidos] = useState([]);
  const [recientes, setRecientes] = useState(() => new Set());
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null);
  const [domiciliarios, setDomiciliarios] = useState([]);
  // Id del pedido al que se le está eligiendo domiciliario (abre la hoja).
  const [asignando, setAsignando] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");

  const consulta = useCallback(() => {
    if (pestana === "activos") return "activos=true";
    const params = Object.entries({ ...rango, estado: filtroEstado }).filter(([, v]) => v);
    return new URLSearchParams(params).toString();
  }, [pestana, rango, filtroEstado]);

  const cargar = useCallback(async () => {
    try {
      setPedidos(await pedir(`/api/admin/pedidos?${consulta()}`));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [pedir, consulta]);

  useEffect(() => {
    setCargando(true);
    cargar();
  }, [cargar]);

  // Quién puede llevar un pedido. Si falla no se tapa la lista de pedidos: la
  // hoja de asignar simplemente sale vacía y deja reintentar.
  const cargarDomiciliarios = useCallback(
    () => pedir("/api/admin/domiciliarios").then(setDomiciliarios).catch(() => {}),
    [pedir],
  );

  useEffect(() => {
    cargarDomiciliarios();
  }, [cargarDomiciliarios]);

  const resaltar = (id) => {
    setRecientes((previos) => new Set(previos).add(id));
    setTimeout(() => {
      setRecientes((previos) => {
        const siguiente = new Set(previos);
        siguiente.delete(id);
        return siguiente;
      });
    }, RESALTE_MS);
  };

  const conectado = useWebSocket("/ws", TOPICS, (topic, data) => {
    if (topic === "/topic/admin/pedidos") {
      // En el historial solo interesa si hoy está dentro del rango mirado.
      if (pestana === "historial" && (rango.hasta || hoyISO()) < hoyISO()) return;
      setPedidos((lista) => (lista.some((p) => p.id === data.id) ? lista : [data, ...lista]));
      resaltar(data.id);
      return;
    }
    // El aviso de estado trae solo { id, estado, siguientes } y, si cambió
    // quién lo lleva, `domiciliario`. Un pedido que termina suelta al suyo.
    cargarDomiciliarios();
    setPedidos((lista) => {
      if (!lista.some((p) => p.id === data.id)) {
        cargar();
        return lista;
      }
      return lista.map((p) => (p.id === data.id ? { ...p, ...data } : p));
    });
  });

  // Al reconectar se recupera lo que pudo pasar mientras no había conexión.
  const estuvoConectado = useRef(conectado);
  useEffect(() => {
    if (conectado && !estuvoConectado.current) cargar();
    estuvoConectado.current = conectado;
  }, [conectado, cargar]);

  const cambiarEstado = async (pedido, estado) => {
    if (estado === "cancelado" && !window.confirm(`¿Cancelar el pedido ${codigoCorto(pedido.id)}?`)) return;
    setOcupado(pedido.id);
    setError("");
    try {
      const actualizado = await pedir(`/api/admin/pedidos/${pedido.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      setPedidos((lista) => lista.map((p) => (p.id === pedido.id ? actualizado : p)));
    } catch (err) {
      setError(err.message);
      cargar();
    } finally {
      setOcupado(null);
    }
  };

  // Asigna o cambia quién lleva el pedido. Devuelve si salió bien, para que la
  // hoja sepa si puede cerrarse.
  const asignarDomiciliario = async (pedido, domiciliarioId) => {
    setOcupado(pedido.id);
    setErrorHoja("");
    try {
      const actualizado = await pedir(`/api/admin/pedidos/${pedido.id}/domiciliario`, {
        method: "PATCH",
        body: JSON.stringify({ domiciliarioId }),
      });
      setPedidos((lista) => lista.map((p) => (p.id === pedido.id ? actualizado : p)));
      setAsignando(null);
    } catch (err) {
      setErrorHoja(err.message);
    } finally {
      setOcupado(null);
      cargarDomiciliarios();
    }
  };

  const crearDomiciliario = async (datos) => {
    setErrorHoja("");
    try {
      await pedir("/api/admin/domiciliarios", { method: "POST", body: JSON.stringify(datos) });
      await cargarDomiciliarios();
      return true;
    } catch (err) {
      setErrorHoja(err.message);
      return false;
    }
  };

  // En "Activos" un pedido que termina sale de la lista.
  const visibles = ordenar(
    pestana === "activos" ? pedidos.filter((p) => !["entregado", "cancelado"].includes(p.estado)) : pedidos,
    pestana,
  );
  const porConfirmar = visibles.filter((p) => p.estado === "pendiente").length;
  // Se busca en la lista viva: si el pedido termina mientras la hoja está
  // abierta, la hoja se cierra sola.
  const pedidoAsignando = pedidos.find((p) => p.id === asignando && !["entregado", "cancelado"].includes(p.estado));

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        {PESTANAS.map(({ clave, texto }) => (
          <Boton
            key={clave}
            variante={pestana === clave ? "primario" : "secundario"}
            className="flex-1"
            onClick={() => setPestana(clave)}
          >
            {texto}
          </Boton>
        ))}
      </div>

      {pestana === "historial" && (
        <>
          <RangoFechas rango={rango} onCambiar={setRango} />
          <Selector
            etiqueta="Estado"
            className="mb-4"
            opciones={OPCIONES_ESTADO}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          />
        </>
      )}

      <div className="mb-3 flex items-center justify-between text-sm font-semibold">
        <span className={`flex items-center gap-2 ${conectado ? "text-listo" : "text-tibio"}`}>
          <span className={`size-2.5 rounded-full ${conectado ? "bg-listo" : "bg-tibio"}`} />
          {conectado ? "En vivo" : "Reconectando…"}
        </span>
        {pestana === "activos" && porConfirmar > 0 && <span className="text-brasa">{porConfirmar} por confirmar</span>}
      </div>

      <Aviso onReintentar={cargar} className="mb-4">
        {error}
      </Aviso>

      {cargando && <Cargando />}
      {!cargando && visibles.length === 0 && (
        <Vacio>
          {pestana === "activos"
            ? "No hay pedidos web activos. Los nuevos aparecen aquí solos."
            : "No hubo pedidos web en este rango."}
        </Vacio>
      )}

      <ul className="space-y-3">
        {visibles.map((p) => (
          <TarjetaPedido
            key={p.id}
            pedido={p}
            nuevo={recientes.has(p.id)}
            ocupado={ocupado === p.id}
            onEstado={(estado) => cambiarEstado(p, estado)}
            onDomiciliario={() => {
              setErrorHoja("");
              cargarDomiciliarios();
              setAsignando(p.id);
            }}
          />
        ))}
      </ul>

      {pedidoAsignando && (
        <HojaDomiciliario
          pedido={pedidoAsignando}
          domiciliarios={domiciliarios}
          error={errorHoja}
          ocupado={ocupado === pedidoAsignando.id}
          onElegir={(domiciliarioId) => asignarDomiciliario(pedidoAsignando, domiciliarioId)}
          onCrear={crearDomiciliario}
          onCerrar={() => setAsignando(null)}
        />
      )}
    </div>
  );
}

// Elegir quién lleva un pedido. Con uno ya asignado, la hoja sirve para
// cambiarlo: es un paso aparte y a propósito, no una lista siempre abierta
// donde un toque de más lo cambia sin querer.
function HojaDomiciliario({ pedido, domiciliarios, error, ocupado, onElegir, onCrear, onCerrar }) {
  const [nuevo, setNuevo] = useState(null);
  const [creando, setCreando] = useState(false);
  const actual = pedido.domiciliario;
  const otros = domiciliarios.filter((d) => d.id !== actual?.id);

  const elegir = (d) => {
    // En camino, el pedido ya va con alguien: cambiarlo se confirma.
    if (
      actual &&
      pedido.estado === "en_camino" &&
      !window.confirm(`El pedido ya va en camino con ${actual.nombre}. ¿Pasárselo a ${d.nombre}?`)
    ) {
      return;
    }
    onElegir(d.id);
  };

  const crear = async (e) => {
    e.preventDefault();
    setCreando(true);
    if (await onCrear(nuevo)) setNuevo(null);
    setCreando(false);
  };

  return (
    <Hoja
      titulo={`${actual ? "Cambiar" : "Asignar"} domiciliario, pedido ${codigoCorto(pedido.id)}`}
      error={error}
      onCerrar={onCerrar}
    >
      <p className="mb-3 text-[15px] text-tinta-2">
        {actual ? (
          <>
            Lo lleva <strong className="text-tinta">{actual.nombre}</strong>. Elige a quién pasárselo; {actual.nombre}{" "}
            vuelve a quedar disponible.
          </>
        ) : (
          "Elige quién lleva este pedido. Queda ocupado hasta que el pedido se entregue o se cancele."
        )}
      </p>

      {otros.length === 0 ? (
        <p className="mb-4 border-l-4 border-tibio bg-tibio/10 px-3 py-2 text-[15px]">
          No hay {actual ? "otros " : ""}domiciliarios registrados. Agrega uno aquí abajo.
        </p>
      ) : (
        <ul className="mb-4 overflow-hidden rounded-xl border border-filete bg-white">
          {otros.map((d) => {
            const libre = d.estado === "disponible";
            return (
              <li key={d.id} className="border-b border-filete last:border-0">
                <button
                  disabled={!libre || ocupado}
                  onClick={() => elegir(d)}
                  className="flex min-h-13 w-full items-center gap-3 px-4 text-left disabled:cursor-not-allowed"
                >
                  <Bike size={18} aria-hidden className={libre ? "text-tinta" : "text-tinta-2"} />
                  <span className={`min-w-0 flex-1 truncate text-[17px] font-bold ${libre ? "text-tinta" : "text-tinta-2"}`}>
                    {d.nombre}
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[13px] font-bold ${
                      libre ? "bg-listo text-white" : "bg-espera text-tinta-2"
                    }`}
                  >
                    {libre ? "Disponible" : "Con otro pedido"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {nuevo ? (
        <form onSubmit={crear} className="space-y-3 border-t border-filete pt-4">
          <Campo
            etiqueta="Nombre"
            required
            autoFocus
            maxLength={255}
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
          />
          <Campo
            etiqueta="Apellido"
            required
            maxLength={255}
            value={nuevo.apellido}
            onChange={(e) => setNuevo({ ...nuevo, apellido: e.target.value })}
          />
          <div className="flex gap-2">
            <Boton type="button" variante="secundario" className="flex-1" onClick={() => setNuevo(null)}>
              Cancelar
            </Boton>
            <Boton type="submit" className="flex-1" cargando={creando}>
              Agregar
            </Boton>
          </div>
        </form>
      ) : (
        <Boton variante="secundario" className="w-full" onClick={() => setNuevo({ nombre: "", apellido: "" })}>
          <span className="flex items-center justify-center gap-2">
            <Plus size={18} /> Nuevo domiciliario
          </span>
        </Boton>
      )}
    </Hoja>
  );
}

function TarjetaPedido({ pedido: p, nuevo, ocupado, onEstado, onDomiciliario }) {
  const espera = ["pendiente", "confirmado"].includes(p.estado) ? minutosDesde(p.fechaInicio) : null;
  const avance = (p.siguientes ?? []).filter((e) => e !== "cancelado");
  const puedeCancelar = (p.siguientes ?? []).includes("cancelado");
  const terminado = ["entregado", "cancelado"].includes(p.estado);

  return (
    <li className={`rounded-xl border bg-white p-4 ${nuevo ? "border-l-4 border-brasa" : "border-filete"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-extrabold text-tinta tabular-nums">{codigoCorto(p.id)}</span>
        <Estado valor={p.estado} etiquetas={ETIQUETA_PEDIDO} colores={COLOR_PEDIDO} />
        {nuevo && <span className="rounded bg-brasa px-2 py-0.5 text-[13px] font-bold text-white">Nuevo</span>}
        {/* Avance en cocina: solo mientras el pedido se está preparando. */}
        {p.cocina && ["confirmado", "preparando"].includes(p.estado) && (
          <span
            className={`rounded px-2 py-0.5 text-[13px] font-bold ${
              p.cocina.completo ? "bg-listo text-white" : "bg-espera text-tinta"
            }`}
          >
            {p.cocina.completo ? "Listo para despachar" : `En cocina: ${p.cocina.listos} de ${p.cocina.total} listos`}
          </span>
        )}
        {espera !== null && (
          <span className={`ml-auto text-sm font-bold tabular-nums ${PIEL_ESPERA[nivelDeEspera(espera)].reloj}`}>
            {espera} min
          </span>
        )}
      </div>

      <div className="text-[15px] text-tinta">
        <p className="font-bold">{p.cliente?.nombre ?? "Cliente"}</p>
        {p.cliente?.celular && (
          <a href={`tel:${p.cliente.celular}`} className="inline-flex min-h-10 items-center gap-1 text-rio underline">
            <Phone size={16} /> {p.cliente.celular}
          </a>
        )}
        {p.direccion && <p className="text-tinta-2">{p.direccion}</p>}
        {p.fechaProgramada && <p className="text-tinta-2">Programado: {fechaHora(p.fechaProgramada)}</p>}
        {p.observaciones && <p className="mt-2 border-l-4 border-tibio bg-tibio/10 px-3 py-1">{p.observaciones}</p>}
      </div>

      <ul className="mt-3 border-t border-filete pt-2 text-[15px]">
        {p.items.map((i, n) => (
          <li key={`${i.menuItemId}-${n}`} className="flex justify-between py-0.5">
            <span>
              {i.cantidad}× {i.nombre}
            </span>
            <span className="tabular-nums">{pesos(i.subtotal)}</span>
          </li>
        ))}
        <li className="mt-1 flex justify-between border-t border-filete pt-1 font-extrabold">
          <span>Total</span>
          <span className="tabular-nums">{pesos(p.total)}</span>
        </li>
      </ul>

      <p className="mt-2 text-[13px] text-tinta-2">
        {fechaHora(p.fechaInicio)}
        {p.pagoId ? " · Pago registrado" : " · Sin pago"}
      </p>

      {/* Quién lo lleva. En un pedido terminado solo se muestra si hubo alguien. */}
      {(!terminado || p.domiciliario) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-filete pt-3">
          {/* En el celular el nombre ocupa su renglón y el botón va debajo: un
              nombre cortado no dice quién lleva el pedido. */}
          <p className="flex min-w-0 flex-1 basis-full items-center gap-2 text-[15px] sm:basis-0">
            <Bike size={18} aria-hidden className="shrink-0 text-tinta-2" />
            {p.domiciliario ? (
              <span className="min-w-0">
                <span className="text-tinta-2">{terminado ? "Lo llevó " : "Lo lleva "}</span>
                <strong className="text-tinta">{p.domiciliario.nombre}</strong>
              </span>
            ) : (
              <span className="font-semibold text-tinta-2">Sin domiciliario</span>
            )}
          </p>
          {!terminado && (
            <Boton variante="secundario" className="w-full sm:w-auto" disabled={ocupado} onClick={onDomiciliario}>
              {p.domiciliario ? "Cambiar domiciliario" : "Asignar domiciliario"}
            </Boton>
          )}
        </div>
      )}

      {(avance.length > 0 || puedeCancelar) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {avance.map((estado) => (
            <Boton key={estado} cargando={ocupado} className="flex-1" onClick={() => onEstado(estado)}>
              {ACCION_PEDIDO[estado] ?? estado}
            </Boton>
          ))}
          {puedeCancelar && (
            <Boton variante="secundario" disabled={ocupado} onClick={() => onEstado("cancelado")}>
              Cancelar
            </Boton>
          )}
        </div>
      )}
    </li>
  );
}
