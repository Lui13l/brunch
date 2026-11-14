import { useState } from "react";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { Boton } from "../ui";
import { EN_COCINA, pesos } from "../../lib/formato";

const METODOS = [
  { valor: "EFECTIVO", texto: "Efectivo", Icono: Banknote },
  { valor: "TARJETA", texto: "Tarjeta", Icono: CreditCard },
  { valor: "TRANSFERENCIA", texto: "Transferencia", Icono: Smartphone },
];

// Cerrar la mesa, en un solo paso: el total, cómo pagan y confirmar. Antes de
// cobrar se resuelve lo que estorba: platos que no se enviaron y platos que
// siguen en cocina.
export default function Cobro({ comanda, esAdmin, ocupado, onEnviar, onQuitarBorradores, onCobrar, onAnular, onVolver }) {
  const [metodo, setMetodo] = useState(null);
  const [forzar, setForzar] = useState(false);

  const borradores = comanda.items.filter((i) => i.estado === "BORRADOR");
  const enCocina = comanda.items.filter((i) => EN_COCINA.includes(i.estado));
  const cobrables = comanda.items.filter((i) => !["BORRADOR", "CANCELADO"].includes(i.estado));
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  // Nada servido: no hay qué cobrar. La mesa se cierra sin registrar una venta.
  if (cobrables.length === 0) {
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-filete bg-mantel p-5 text-center">
          <h2 className="font-titulo text-3xl font-semibold tracking-[-0.02em] text-tinta">No hay nada que cobrar</h2>
          <p className="mx-auto mt-2 max-w-sm text-[17px] text-tinta-2">
            {borradores.length > 0
              ? `Hay ${plural(borradores.length, "plato", "platos")} sin enviar a cocina. Si cierras la mesa se descartan.`
              : "La cuenta está vacía. Cierra la mesa para dejarla libre."}
          </p>
          <div className="mt-5 grid gap-2">
            <Boton variante="marca" cargando={ocupado} onClick={onAnular}>
              Cerrar la mesa sin cobrar
            </Boton>
            <Boton variante="secundario" onClick={onVolver}>
              Volver a la cuenta
            </Boton>
          </div>
        </div>
      </div>
    );
  }

  const bloqueado = borradores.length > 0 || (enCocina.length > 0 && !forzar);

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-rio p-5 text-white">
        <p className="text-base font-semibold text-white/75">Total a cobrar</p>
        <p className="mt-1 font-titulo text-6xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {pesos(comanda.total)}
        </p>
        <p className="mt-2 text-[15px] text-white/75">{plural(cobrables.length, "plato", "platos")} en la cuenta</p>
      </div>

      {borradores.length > 0 && (
        <div className="rounded-2xl border border-tibio bg-tibio/15 p-4">
          <p className="text-[17px] font-bold text-tinta">
            Hay {plural(borradores.length, "plato", "platos")} sin enviar a cocina
          </p>
          <p className="mt-1 text-[15px] text-tinta-2">Antes de cobrar, envíalos o quítalos de la cuenta.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Boton cargando={ocupado} onClick={onEnviar}>
              Enviar a cocina
            </Boton>
            <Boton variante="secundario" disabled={ocupado} onClick={onQuitarBorradores}>
              Quitarlos de la cuenta
            </Boton>
          </div>
        </div>
      )}

      {enCocina.length > 0 && (
        <div className="rounded-2xl border border-tibio bg-tibio/15 p-4">
          <p className="text-[17px] font-bold text-tinta">
            {enCocina.length === 1 ? "Todavía hay 1 plato en cocina" : `Todavía hay ${enCocina.length} platos en cocina`}
          </p>
          {esAdmin ? (
            <label className="mt-2 flex min-h-12 items-center gap-3 text-[15px] font-semibold text-tinta">
              <input
                type="checkbox"
                checked={forzar}
                onChange={(e) => setForzar(e.target.checked)}
                className="size-5 accent-rio"
              />
              Cobrar de todos modos. Esos platos se cancelan y no se cobran.
            </label>
          ) : (
            <p className="mt-1 text-[15px] text-tinta-2">
              Espera a que salgan, o cancélalos desde la cuenta. Un administrador puede cobrar sin esperar.
            </p>
          )}
        </div>
      )}

      <fieldset>
        <legend className="mb-2 font-titulo text-2xl font-semibold tracking-[-0.02em] text-tinta">¿Cómo pagan?</legend>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={metodo === opcion.valor}
              onClick={() => setMetodo(opcion.valor)}
              className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl px-2 text-[15px] font-bold transition active:scale-[0.98] ${
                metodo === opcion.valor ? "bg-tinta text-white" : "border border-filete bg-mantel text-tinta"
              }`}
            >
              <opcion.Icono size={26} strokeWidth={1.8} aria-hidden />
              {opcion.texto}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Boton
          variante="marca"
          className="min-h-14 text-[17px]"
          disabled={!metodo || bloqueado}
          cargando={ocupado}
          onClick={() => onCobrar(metodo, forzar)}
        >
          {metodo ? `Confirmar cobro de ${pesos(comanda.total)}` : "Elige cómo pagan"}
        </Boton>
        <Boton variante="secundario" onClick={onVolver}>
          Volver a la cuenta
        </Boton>
      </div>
    </div>
  );
}
