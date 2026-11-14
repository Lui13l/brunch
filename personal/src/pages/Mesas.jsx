import { useCallback, useEffect, useState } from "react";
import { Check, Link2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/sesion";
import { useWebSocket } from "../hooks/useWebSocket";
import { Cabecera, Pantalla } from "../components/Layout";
import { Aviso, Boton, Cargando } from "../components/ui";
import { sonarMesaLista } from "../lib/aviso";
import { minutosDesde, pesos, resumenDeMesa, tituloDeMesas } from "../lib/formato";

const TOPICS = ["/topic/salon"];

// El plano del salón. Se mira de pasada y desde lejos, así que el estado va en
// el relleno de la baldosa, no en el borde: a tres metros el borde no existe.
//
// El verde está reservado a una sola cosa: la mesa está completa y hay que ir
// a por ella. Si se usara también para "alguno listo" dejaría de ser una orden
// y pasaría a ser ruido.
export default function Mesas() {
  const { pedir, user } = useAuth();
  const navigate = useNavigate();
  const [mesas, setMesas] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState(null);
  const [listas, setListas] = useState([]);
  // Modo "juntar mesas": ids de las mesas libres elegidas para un grupo, en el
  // orden en que se tocaron (la primera es la principal). null = modo normal.
  const [juntando, setJuntando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [mesas, comandas] = await Promise.all([pedir("/api/mesas"), pedir("/api/comandas")]);
      setMesas(mesas);
      setComandas(comandas);
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

  // Otro mesero puede abrir o cerrar una mesa; y cocina avisa cuando una queda
  // completa. Ese aviso lo decide el servidor, que es quien sabe si todavía
  // queda algo suyo en el fuego.
  useWebSocket("/ws", TOPICS, (_topic, mensaje) => {
    // Cambió el inventario (platos agotados): eso es asunto de la carta, no del salón.
    if (mensaje?.tipo === "carta") return;
    if (mensaje?.tipo === "mesaCompleta") {
      sonarMesaLista();
      setListas((previas) =>
        previas.some((l) => l.comandaId === mensaje.comandaId) ? previas : [...previas, mensaje],
      );
    }
    cargar();
  });

  const abrir = async (mesa) => {
    setAbriendo(mesa.id);
    try {
      const comanda = await pedir("/api/comandas", { method: "POST", body: JSON.stringify({ mesaId: mesa.id }) });
      navigate(`/comanda/${comanda.id}`);
    } catch (err) {
      setError(err.message);
      cargar();
    } finally {
      setAbriendo(null);
    }
  };

  // Abre una sola cuenta para todas las mesas elegidas.
  const abrirJuntas = async () => {
    const [principal, ...extras] = juntando;
    setAbriendo(principal);
    try {
      const comanda = await pedir("/api/comandas", {
        method: "POST",
        body: JSON.stringify({ mesaId: principal, mesasExtra: extras }),
      });
      navigate(`/comanda/${comanda.id}`);
    } catch (err) {
      setError(err.message);
      setJuntando(null);
      cargar();
    } finally {
      setAbriendo(null);
    }
  };

  const alternar = (mesa) =>
    setJuntando((elegidas) =>
      elegidas.includes(mesa.id) ? elegidas.filter((id) => id !== mesa.id) : [...elegidas, mesa.id],
    );

  // Una cuenta ocupa su mesa principal y las que se le hayan juntado.
  const porMesa = new Map(comandas.flatMap((c) => [c.mesaId, ...(c.mesasExtra ?? []).map((m) => m.id)].map((id) => [id, c])));
  const completas = comandas.filter((c) => resumenDeMesa(c).estado === "completa");

  // El aviso emergente desaparece solo; el estado persistente vive en la
  // baldosa, así que nada se pierde por cerrarlo.
  const descartar = (comandaId) => setListas((previas) => previas.filter((l) => l.comandaId !== comandaId));

  return (
    <Pantalla>
      <Cabecera
        titulo="Salón"
        atras={user?.rol === "ADMIN" ? "/admin" : undefined}
        acciones={
          !juntando && (
            <button
              onClick={() => setJuntando([])}
              className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white/15 px-3 text-[15px] font-bold text-white active:bg-white/25"
            >
              <Link2 size={18} aria-hidden />
              Juntar mesas
            </button>
          )
        }
      />
      <Aviso onReintentar={cargar}>{error}</Aviso>

      {juntando && (
        <p className="bg-tibio px-4 py-3 text-lg font-bold text-tinta">
          Toca las mesas libres del grupo. Se abrirá una sola cuenta para todas.
        </p>
      )}

      {listas.map((aviso) => (
        <MesaListaAviso
          key={aviso.comandaId}
          aviso={aviso}
          onIr={() => {
            descartar(aviso.comandaId);
            navigate(`/comanda/${aviso.comandaId}`);
          }}
          onCerrar={() => descartar(aviso.comandaId)}
        />
      ))}

      {completas.length > 0 && listas.length === 0 && (
        <p className="flex items-center gap-2 bg-listo px-4 py-3 text-lg font-bold text-white">
          <Check size={22} strokeWidth={3} />
          {completas.length === 1
            ? `${tituloDeMesas(completas[0])} lista para llevar`
            : `${completas.length} mesas listas para llevar`}
        </p>
      )}

      {cargando ? (
        <Cargando />
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {mesas.map((mesa) => (
            <Baldosa
              key={mesa.id}
              mesa={mesa}
              comanda={porMesa.get(mesa.id)}
              ocupado={abriendo === mesa.id}
              eligiendo={Boolean(juntando)}
              orden={juntando ? juntando.indexOf(mesa.id) + 1 : 0}
              onAbrir={() => (juntando ? alternar(mesa) : abrir(mesa))}
              onEntrar={(id) => navigate(`/comanda/${id}`)}
            />
          ))}
        </div>
      )}

      {juntando && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-filete bg-mantel px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Boton variante="secundario" className="flex-1" onClick={() => setJuntando(null)}>
            Cancelar
          </Boton>
          <Boton className="flex-[2]" disabled={juntando.length < 2} cargando={abriendo !== null} onClick={abrirJuntas}>
            {juntando.length < 2 ? "Elige al menos 2 mesas" : `Abrir juntas (${juntando.length})`}
          </Boton>
        </div>
      )}
    </Pantalla>
  );
}

// El aviso que llega de cocina. Ocupa el ancho entero y lleva su propia acción:
// quien lo ve con las manos llenas solo tiene que tocarlo para ir a la mesa.
function MesaListaAviso({ aviso, onIr, onCerrar }) {
  useEffect(() => {
    const t = setTimeout(onCerrar, 20_000);
    return () => clearTimeout(t);
  }, [onCerrar]);

  return (
    <div className="flex items-center gap-3 bg-listo px-4 py-3 text-white">
      <Check size={28} strokeWidth={3} className="shrink-0" />
      <button onClick={onIr} className="min-w-0 flex-1 text-left">
        <p className="text-xl leading-tight font-extrabold">Mesa {aviso.mesa} completa</p>
        <p className="text-[15px] font-semibold text-white/80">
          {aviso.platos} {aviso.platos === 1 ? "plato listo" : "platos listos"} para llevar
        </p>
      </button>
      <button
        onClick={onCerrar}
        aria-label="Descartar aviso"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg active:bg-white/20"
      >
        <X size={20} />
      </button>
    </div>
  );
}

// `eligiendo`: modo "juntar mesas". Solo las libres se pueden tocar; las
// elegidas muestran su orden (la 1 es la mesa principal de la cuenta).
function Baldosa({ mesa, comanda, ocupado, eligiendo, orden, onAbrir, onEntrar }) {
  const { estado, listos, total } = resumenDeMesa(comanda);
  const completa = estado === "completa";
  const elegida = orden > 0;
  // Las otras mesas con las que comparte la cuenta: "Con 5 y 6".
  const companeras = (mesa.grupo ?? []).filter((n) => n !== mesa.numero);

  const piel = elegida
    ? "bg-tibio text-tinta"
    : completa
      ? "bg-listo text-white"
      : comanda
        ? "bg-tinta text-white"
        : "bg-mantel text-tinta";
  const tenue = comanda && !elegida ? "text-white/70" : "text-tinta-2";

  return (
    <button
      disabled={ocupado || (eligiendo && Boolean(comanda))}
      aria-pressed={eligiendo ? elegida : undefined}
      onClick={() => (comanda ? onEntrar(comanda.id) : onAbrir())}
      className={`flex min-h-36 flex-col justify-between rounded-2xl p-4 text-left transition active:scale-[0.98] disabled:opacity-60 ${piel} ${
        comanda || elegida ? "" : "border border-filete"
      } ${eligiendo && comanda ? "disabled:opacity-35" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-5xl leading-none font-extrabold tracking-[-0.04em]">{mesa.numero}</span>
        {elegida ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tinta text-base font-extrabold text-white">
            {orden}
          </span>
        ) : completa ? (
          <Check size={26} strokeWidth={3} className="shrink-0" />
        ) : (
          <span className={`text-sm font-semibold ${tenue}`}>{mesa.capacidad}p</span>
        )}
      </div>

      {comanda ? (
        <div>
          {companeras.length > 0 && (
            <p className={`mb-1.5 flex items-center gap-1 text-sm font-bold ${tenue}`}>
              <Link2 size={14} aria-hidden />
              Con {companeras.join(" y ")}
            </p>
          )}
          <p className="text-2xl leading-none font-extrabold tracking-[-0.02em]">{pesos(comanda.total)}</p>
          {completa ? (
            <p className="mt-1 text-[15px] font-extrabold">Todo listo</p>
          ) : (
            <>
              <p className={`mt-1 text-sm font-semibold ${tenue}`}>
                {total} {total === 1 ? "plato" : "platos"}, {minutosDesde(comanda.fechaApertura)} min
              </p>
              {/* "Alguno listo" informa; no manda. Por eso va en ámbar y no en
                  verde: el verde significa ir a por la mesa. */}
              {estado === "parcial" && (
                <p className="mt-1 text-sm font-extrabold text-tibio">
                  {listos} de {total} listos
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="text-sm font-semibold text-tinta-2">
          {elegida ? (orden === 1 ? "Mesa principal" : "En el grupo") : eligiendo ? "Toca para sumarla" : "Toca para abrir"}
        </p>
      )}
    </button>
  );
}
