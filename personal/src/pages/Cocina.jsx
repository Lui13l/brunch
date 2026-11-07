import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/sesion";
import { useWebSocket } from "../hooks/useWebSocket";
import { Cabecera, Pantalla } from "../components/Layout";
import { Aviso, Cargando } from "../components/ui";
import { sonarPlatoNuevo } from "../lib/aviso";
import { minutosDesde, nivelDeEspera, PIEL_ESPERA } from "../lib/formato";

const TOPICS = ["/topic/cocina"];

// Tablero de cocina. Se mira desde la línea, a dos o tres metros, con las manos
// ocupadas y bajo luz fuerte. Por eso: pieza grande, número de mesa y minutos
// como elementos dominantes, y relleno sólido en vez de borde cuando algo va
// tarde — un borde no se ve a esa distancia.
export default function Cocina() {
  const { pedir } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const conocidos = useRef(new Set());
  const yaCargo = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const pendientes = await pedir("/api/cocina/pendientes");
      const nuevos = pendientes.filter((i) => !conocidos.current.has(i.id));
      // No suena en la primera carga (lo que ya estaba), pero sí con el primer
      // plato que entra a una cocina vacía.
      if (nuevos.length > 0 && yaCargo.current) sonarPlatoNuevo();
      yaCargo.current = true;
      conocidos.current = new Set(pendientes.map((i) => i.id));
      setItems(pendientes);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [pedir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useWebSocket("/ws", TOPICS, cargar);
  useMantenerPantallaEncendida();

  // Reloj propio: los minutos avanzan sin pedir nada al servidor.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const marcar = async (item, estado) => {
    try {
      await pedir(`/api/cocina/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  // Lo más viejo primero: es el orden en que hay que resolverlo.
  const porEstado = (estado) =>
    items
      .filter((i) => i.estado === estado)
      .sort((a, b) => new Date(a.fechaEnvio) - new Date(b.fechaEnvio));

  const enCola = porEstado("PENDIENTE");
  const preparando = porEstado("PREPARANDO");

  return (
    <Pantalla>
      <Cabecera titulo="Cocina" />
      <Aviso onReintentar={cargar}>{error}</Aviso>

      {cargando ? (
        <Cargando />
      ) : items.length === 0 ? (
        <p className="px-6 py-24 text-center text-3xl font-bold text-tinta-2">La cocina está al día</p>
      ) : (
        <div className="grid gap-5 p-4 xl:grid-cols-2">
          <Banda
            titulo="En cola"
            items={enCola}
            accion="Empezar"
            onAccion={(i) => marcar(i, "PREPARANDO")}
            vacia="Nada esperando"
          />
          <Banda
            titulo="Preparando"
            items={preparando}
            accion="Listo"
            enMarcha
            onAccion={(i) => marcar(i, "LISTO")}
            vacia="Nada en el fuego"
          />
        </div>
      )}
    </Pantalla>
  );
}

function Banda({ titulo, items, accion, onAccion, enMarcha, vacia }) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 text-2xl font-extrabold tracking-[-0.02em] text-tinta">
        {titulo}
        <span className="text-xl font-bold text-tinta-2">{items.length}</span>
      </h2>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-filete px-4 py-10 text-center text-xl text-tinta-2">
          {vacia}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <Ticket key={item.id} item={item} accion={accion} onAccion={onAccion} enMarcha={enMarcha} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Ticket({ item, accion, onAccion, enMarcha }) {
  const minutos = minutosDesde(item.fechaEnvio);
  const piel = PIEL_ESPERA[nivelDeEspera(minutos)];
  const tarde = piel === PIEL_ESPERA.tarde;

  return (
    <li className={`flex overflow-hidden rounded-xl ${piel.pieza}`}>
      {/* La pestaña del canto es lo que se lee desde lejos: un raíl de colores
          que dice la antigüedad sin leer una sola palabra. */}
      <span aria-hidden className={`w-3 shrink-0 ${piel.pestana}`} />

      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-sm font-bold ${tarde ? "text-white/70" : "text-tinta-2"}`}>Mesa</p>
            <p className="text-5xl leading-none font-extrabold tracking-[-0.03em]">{item.mesa}</p>
          </div>
          <p className={`text-5xl leading-none font-extrabold tracking-[-0.03em] ${piel.reloj}`}>
            {minutos}
            <span className="text-2xl font-bold"> min</span>
          </p>
        </div>

        <p className="mt-4 text-3xl leading-tight font-bold tracking-[-0.02em]">
          <span className={tarde ? "text-white/70" : "text-tinta-2"}>{item.cantidad}×</span> {item.nombre}
        </p>

        {item.notas && (
          <p
            className={`mt-2 inline-block rounded px-2 py-1 text-xl font-bold ${
              tarde ? "bg-white/20 text-white" : "bg-tibio/20 text-tinta"
            }`}
          >
            {item.notas}
          </p>
        )}

        <button
          onClick={() => onAccion(item)}
          className={`mt-4 min-h-16 w-full rounded-lg text-xl font-extrabold transition active:scale-[0.99] ${
            tarde
              ? "bg-white text-brasa"
              : enMarcha
                ? "bg-listo text-white"
                : "bg-tinta text-white"
          }`}
        >
          {accion}
        </button>
      </div>
    </li>
  );
}

// Evita que la tablet se apague sola durante el servicio.
function useMantenerPantallaEncendida() {
  useEffect(() => {
    if (!navigator.wakeLock) return;
    let bloqueo = null;

    const pedirBloqueo = async () => {
      try {
        bloqueo = await navigator.wakeLock.request("screen");
      } catch {
        // El navegador puede negarlo (batería baja): no es crítico.
      }
    };

    pedirBloqueo();
    // Al volver de segundo plano el bloqueo se pierde y hay que pedirlo otra vez.
    const alVolver = () => document.visibilityState === "visible" && pedirBloqueo();
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      bloqueo?.release().catch(() => {});
    };
  }, []);
}
