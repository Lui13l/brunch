import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/sesion";
import { useWebSocket } from "../hooks/useWebSocket";
import { Cabecera, Pantalla } from "../components/Layout";
import { Aviso, Cargando } from "../components/ui";
import { sonarMesaLista } from "../lib/aviso";
import { minutosDesde, pesos, resumenDeMesa } from "../lib/formato";

const TOPICS = ["/topic/salon"];

// El plano del salón. Se mira de pasada y desde lejos, así que el estado va en
// el relleno de la baldosa, no en el borde: a tres metros el borde no existe.
//
// El verde está reservado a una sola cosa: la mesa está completa y hay que ir
// a por ella. Si se usara también para "alguno listo" dejaría de ser una orden
// y pasaría a ser ruido.
export default function Mesas() {
  const { pedir } = useAuth();
  const navigate = useNavigate();
  const [mesas, setMesas] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState(null);
  const [listas, setListas] = useState([]);

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

  const porMesa = new Map(comandas.map((c) => [c.mesaId, c]));
  const completas = comandas.filter((c) => resumenDeMesa(c).estado === "completa");

  // El aviso emergente desaparece solo; el estado persistente vive en la
  // baldosa, así que nada se pierde por cerrarlo.
  const descartar = (comandaId) => setListas((previas) => previas.filter((l) => l.comandaId !== comandaId));

  return (
    <Pantalla>
      <Cabecera titulo="Salón" />
      <Aviso onReintentar={cargar}>{error}</Aviso>

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
            ? `Mesa ${completas[0].mesaNumero} lista para llevar`
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
              onAbrir={() => abrir(mesa)}
              onEntrar={(id) => navigate(`/comanda/${id}`)}
            />
          ))}
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

function Baldosa({ mesa, comanda, ocupado, onAbrir, onEntrar }) {
  const { estado, listos, total } = resumenDeMesa(comanda);
  const completa = estado === "completa";

  const piel = completa ? "bg-listo text-white" : comanda ? "bg-tinta text-white" : "bg-mantel text-tinta";
  const tenue = comanda ? "text-white/70" : "text-tinta-2";

  return (
    <button
      disabled={ocupado}
      onClick={() => (comanda ? onEntrar(comanda.id) : onAbrir())}
      className={`flex min-h-36 flex-col justify-between rounded-2xl p-4 text-left transition active:scale-[0.98] disabled:opacity-60 ${piel} ${
        comanda ? "" : "border border-filete"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-5xl leading-none font-extrabold tracking-[-0.04em]">{mesa.numero}</span>
        {completa ? (
          <Check size={26} strokeWidth={3} className="shrink-0" />
        ) : (
          <span className={`text-sm font-semibold ${tenue}`}>{mesa.capacidad}p</span>
        )}
      </div>

      {comanda ? (
        <div>
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
        <p className="text-sm font-semibold text-tinta-2">Toca para abrir</p>
      )}
    </button>
  );
}
