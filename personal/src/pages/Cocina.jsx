import { useCallback, useEffect, useRef, useState } from "react";
import { Bike, Check, Flame, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../context/sesion";
import { useWebSocket } from "../hooks/useWebSocket";
import { Cabecera, Pantalla } from "../components/Layout";
import { Aviso, Cargando } from "../components/ui";
import { sonarPlatoNuevo } from "../lib/aviso";
import { minutosDesde, nivelDeEspera, PIEL_ESPERA } from "../lib/formato";

// Cocina escucha también el salón: si se crea o cambia una mesa, o se juntan
// varias, sus contenedores se actualizan solos.
const TOPICS = ["/topic/cocina", "/topic/salon"];
// Avisos del salón que no cambian nada de lo que la cocina tiene que preparar.
const AJENOS = ["carta", "mesaCompleta"];

// Agrupa los platos por su contenedor (una mesa o un domicilio). Cada
// contenedor hereda la antigüedad de su plato más viejo, y se ordenan así: lo
// que más lleva esperando va primero.
const agrupar = (platos) => {
  const grupos = new Map();
  for (const plato of platos) {
    const clave = plato.contenedor?.id ?? plato.comandaId ?? plato.id;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        id: clave,
        tipo: plato.contenedor?.tipo ?? "mesa",
        titulo: plato.contenedor?.titulo ?? `Mesa ${plato.mesa ?? "?"}`,
        platos: [],
      });
    }
    grupos.get(clave).platos.push(plato);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, desde: g.platos.map((p) => p.fechaEnvio).sort()[0] }))
    .sort((a, b) => String(a.desde).localeCompare(String(b.desde)));
};

// Tablero de cocina. Se mira desde la línea, a dos o tres metros, con las manos
// ocupadas y bajo luz fuerte. Por eso: pieza grande, número de mesa y minutos
// como elementos dominantes, y relleno sólido en vez de borde cuando algo va
// tarde — un borde no se ve a esa distancia.
//
// Los platos van agrupados por mesa o por domicilio: la cocina saca cada
// pedido completo, no platos sueltos.
export default function Cocina() {
  const { pedir, user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null);
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

  useWebSocket("/ws", TOPICS, (topic, mensaje) => {
    if (topic === "/topic/salon" && AJENOS.includes(mensaje?.tipo)) return;
    cargar();
  });
  useMantenerPantallaEncendida();

  // Reloj propio: los minutos avanzan sin pedir nada al servidor.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const marcar = async (item, estado) => {
    setOcupado(item.id);
    try {
      await pedir(`/api/cocina/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
      await cargar();
    } catch (err) {
      setError(err.message);
      cargar();
    } finally {
      setOcupado(null);
    }
  };

  const contenedores = agrupar(items);
  const enCola = items.filter((i) => i.estado === "PENDIENTE").length;
  const preparando = items.length - enCola;

  return (
    <Pantalla>
      <Cabecera titulo="Cocina" atras={user?.rol === "ADMIN" ? "/admin" : undefined} />
      <Aviso onReintentar={cargar}>{error}</Aviso>

      {cargando ? (
        <Cargando />
      ) : items.length === 0 ? (
        <p className="px-6 py-24 text-center text-3xl font-bold text-tinta-2">La cocina está al día</p>
      ) : (
        <>
          <dl className="flex gap-6 px-4 pt-4 text-tinta-2">
            <div className="flex items-baseline gap-2">
              <dd className="text-3xl font-extrabold tracking-[-0.02em] text-tinta tabular-nums">{enCola}</dd>
              <dt className="text-lg font-semibold">en cola</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="text-3xl font-extrabold tracking-[-0.02em] text-tinta tabular-nums">{preparando}</dd>
              <dt className="text-lg font-semibold">preparando</dt>
            </div>
          </dl>

          <div className="grid items-start gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {contenedores.map((contenedor) => (
              <Contenedor key={contenedor.id} contenedor={contenedor} onMarcar={marcar} ocupado={ocupado} />
            ))}
          </div>
        </>
      )}
    </Pantalla>
  );
}

// Una mesa o un domicilio con todo lo que tiene en cocina.
function Contenedor({ contenedor, onMarcar, ocupado }) {
  const minutos = minutosDesde(contenedor.desde);
  const piel = PIEL_ESPERA[nivelDeEspera(minutos)];
  const tarde = piel === PIEL_ESPERA.tarde;
  const Icono = contenedor.tipo === "domicilio" ? Bike : UtensilsCrossed;
  const tenue = tarde ? "text-white/75" : "text-tinta-2";

  return (
    <section className={`flex overflow-hidden rounded-2xl ${piel.pieza}`} aria-label={contenedor.titulo}>
      {/* La pestaña del canto es lo que se lee desde lejos: un raíl de colores
          que dice la antigüedad sin leer una sola palabra. */}
      <span aria-hidden className={`w-3 shrink-0 ${piel.pestana}`} />

      <div className="min-w-0 flex-1 p-4">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`flex items-center gap-1.5 text-sm font-bold ${tenue}`}>
              <Icono size={16} strokeWidth={2.2} aria-hidden />
              {contenedor.tipo === "domicilio" ? "Para llevar a domicilio" : "En el salón"}
            </p>
            <h2 className="mt-1 text-4xl leading-none font-extrabold tracking-[-0.03em]">{contenedor.titulo}</h2>
          </div>
          <p className={`shrink-0 text-4xl leading-none font-extrabold tracking-[-0.03em] tabular-nums ${piel.reloj}`}>
            {minutos}
            <span className="text-xl font-bold"> min</span>
          </p>
        </header>

        <ul className={`mt-4 border-t ${tarde ? "border-white/30" : "border-filete"}`}>
          {contenedor.platos.map((plato) => {
            const enMarcha = plato.estado === "PREPARANDO";
            return (
              <li key={plato.id} className={`border-b py-3 ${tarde ? "border-white/30" : "border-filete"}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl leading-tight font-bold tracking-[-0.02em]">
                      <span className={tenue}>{plato.cantidad}×</span> {plato.nombre}
                    </p>
                    {plato.notas && (
                      <p
                        className={`mt-1.5 inline-block rounded px-2 py-1 text-lg font-bold ${
                          tarde ? "bg-white/20 text-white" : "bg-tibio/25 text-tinta"
                        }`}
                      >
                        {plato.notas}
                      </p>
                    )}
                    {enMarcha && (
                      <p className={`mt-1 flex items-center gap-1 text-[15px] font-bold ${tarde ? "text-white" : "text-caramelo"}`}>
                        <Flame size={16} strokeWidth={2.4} aria-hidden /> En el fuego
                      </p>
                    )}
                  </div>

                  <button
                    disabled={ocupado === plato.id}
                    onClick={() => onMarcar(plato, enMarcha ? "LISTO" : "PREPARANDO")}
                    className={`flex min-h-14 min-w-28 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-lg font-extrabold transition active:scale-[0.98] disabled:opacity-60 ${
                      tarde ? "bg-white text-brasa" : enMarcha ? "bg-listo text-white" : "bg-tinta text-white"
                    }`}
                  >
                    {enMarcha && <Check size={20} strokeWidth={3} aria-hidden />}
                    {enMarcha ? "Listo" : "Empezar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
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
