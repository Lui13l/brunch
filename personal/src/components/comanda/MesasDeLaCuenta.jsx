import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Boton, Cargando, Hoja } from "../ui";
import { useAuth } from "../../context/sesion";

// Juntar mesas a una cuenta ya abierta (llegó más gente) o soltarlas. La mesa
// principal no cambia; solo se eligen las que se le suman.
export default function MesasDeLaCuenta({ comanda, onGuardado, onCerrar }) {
  const { pedir } = useAuth();
  const [mesas, setMesas] = useState(null);
  const [elegidas, setElegidas] = useState(() => comanda.mesasExtra.map((m) => m.id));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    pedir("/api/mesas")
      .then(setMesas)
      .catch((err) => setError(err.message));
  }, [pedir]);

  // Se pueden elegir las libres y las que ya son de esta cuenta.
  const disponibles = (mesas ?? []).filter(
    (m) => m.id !== comanda.mesaId && (!m.comandaAbiertaId || m.comandaAbiertaId === comanda.id),
  );

  const alternar = (id) =>
    setElegidas((actuales) => (actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]));

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      await pedir(`/api/comandas/${comanda.id}/mesas`, {
        method: "PATCH",
        body: JSON.stringify({ mesasExtra: elegidas }),
      });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Hoja titulo={`Mesas de esta cuenta`} error={error} onCerrar={onCerrar}>
      {!mesas ? (
        !error && <Cargando />
      ) : (
        <>
          <p className="mb-4 text-[15px] text-tinta-2">
            La cuenta es de la mesa {comanda.mesaNumero}. Toca las mesas libres que se le juntan; al cobrar se
            liberan todas.
          </p>

          {disponibles.length === 0 ? (
            <p className="py-6 text-center text-lg text-tinta-2">No hay otras mesas libres ahora.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {disponibles.map((mesa) => {
                const elegida = elegidas.includes(mesa.id);
                return (
                  <button
                    key={mesa.id}
                    type="button"
                    aria-pressed={elegida}
                    onClick={() => alternar(mesa.id)}
                    className={`relative flex min-h-20 flex-col items-center justify-center rounded-xl transition active:scale-[0.98] ${
                      elegida ? "bg-tibio text-tinta" : "border border-filete bg-mantel text-tinta"
                    }`}
                  >
                    <span className="text-3xl leading-none font-extrabold tracking-[-0.03em]">{mesa.numero}</span>
                    <span className="mt-1 text-[13px] font-semibold text-tinta-2">{mesa.capacidad}p</span>
                    {elegida && <Check size={18} strokeWidth={3} className="absolute top-2 right-2" aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}

          <Boton className="mt-5 w-full" cargando={guardando} onClick={guardar}>
            {elegidas.length === 0 ? "Dejar solo la mesa principal" : `Guardar (${elegidas.length + 1} mesas)`}
          </Boton>
        </>
      )}
    </Hoja>
  );
}
