import { useCallback, useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { Aviso, Boton, Cargando, Estado, RangoFechas, Selector, Vacio } from "../../components/ui";
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
    // El aviso de estado trae solo { id, estado, siguientes }.
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

  // En "Activos" un pedido que termina sale de la lista.
  const visibles = ordenar(
    pestana === "activos" ? pedidos.filter((p) => !["entregado", "cancelado"].includes(p.estado)) : pedidos,
    pestana,
  );
  const porConfirmar = visibles.filter((p) => p.estado === "pendiente").length;

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
          />
        ))}
      </ul>
    </div>
  );
}

function TarjetaPedido({ pedido: p, nuevo, ocupado, onEstado }) {
  const espera = ["pendiente", "confirmado"].includes(p.estado) ? minutosDesde(p.fechaInicio) : null;
  const avance = (p.siguientes ?? []).filter((e) => e !== "cancelado");
  const puedeCancelar = (p.siguientes ?? []).includes("cancelado");

  return (
    <li className={`rounded-xl border bg-white p-4 ${nuevo ? "border-l-4 border-brasa" : "border-filete"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-extrabold text-tinta tabular-nums">{codigoCorto(p.id)}</span>
        <Estado valor={p.estado} etiquetas={ETIQUETA_PEDIDO} colores={COLOR_PEDIDO} />
        {nuevo && <span className="rounded bg-brasa px-2 py-0.5 text-[13px] font-bold text-white">Nuevo</span>}
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
        {p.domiciliario ? ` · Domiciliario: ${p.domiciliario.nombre}` : ""}
        {p.pagoId ? " · Pago registrado" : " · Sin pago"}
      </p>

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
