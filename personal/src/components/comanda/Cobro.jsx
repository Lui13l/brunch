import { useState } from "react";
import { Boton } from "../ui";
import Division from "./Division";
import { EN_COCINA, pesos } from "../../lib/formato";
import { DIVISION_INICIAL, METODOS_PAGO, repartir, unidadesDe } from "../../lib/division";

// Cerrar la mesa, en un solo paso: el total, cómo pagan y confirmar. Antes de
// cobrar se resuelve lo que estorba: platos que no se enviaron y platos que
// siguen en cocina.
export default function Cobro({ comanda, esAdmin, ocupado, onEnviar, onQuitarBorradores, onCobrar, onAnular, onVolver }) {
  const [metodo, setMetodo] = useState(null);
  const [forzar, setForzar] = useState(false);
  // null: una sola cuenta. Con valor: cómo se está dividiendo.
  const [division, setDivision] = useState(null);

  const borradores = comanda.items.filter((i) => i.estado === "BORRADOR");
  const enCocina = comanda.items.filter((i) => EN_COCINA.includes(i.estado));
  const cobrables = comanda.items.filter((i) => !["BORRADOR", "CANCELADO"].includes(i.estado));
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  // Al forzar el cierre, lo que sigue en cocina se cancela y no se cobra: el
  // total que se muestra y se reparte es el que va a calcular el servidor.
  const porCobrar = forzar ? cobrables.filter((i) => !EN_COCINA.includes(i.estado)) : cobrables;
  const total = forzar ? porCobrar.reduce((suma, i) => suma + i.subtotal, 0) : comanda.total;
  const unidades = unidadesDe(porCobrar);
  const reparto = division ? repartir(division, unidades, total) : null;

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

  // Qué le falta al cobro para poder confirmarse; el botón lo dice.
  let falta = null;
  if (!division) {
    if (!metodo) falta = "Elige cómo pagan";
  } else if (reparto.sinRepartir > 0) {
    falta = reparto.sinRepartir === 1 ? "Falta 1 plato por repartir" : `Faltan ${reparto.sinRepartir} platos por repartir`;
  } else if (!reparto.pagos) {
    falta = "Elige cómo paga cada uno";
  }

  const confirmar = () =>
    division ? onCobrar({ pagos: reparto.pagos, forzar }) : onCobrar({ metodoPago: metodo, forzar });

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-rio p-5 text-white">
        <p className="text-base font-semibold text-white/75">Total a cobrar</p>
        <p className="mt-1 font-titulo text-6xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {pesos(total)}
        </p>
        <p className="mt-2 text-[15px] text-white/75">{plural(porCobrar.length, "plato", "platos")} en la cuenta</p>
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

      {/* Dividir solo tiene sentido si hay algo que repartir. */}
      {total > 0 && (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Una cuenta o dividida">
          {[
            { dividida: false, texto: "Una sola cuenta" },
            { dividida: true, texto: "Dividir la cuenta" },
          ].map((opcion) => (
            <button
              key={opcion.texto}
              type="button"
              aria-pressed={Boolean(division) === opcion.dividida}
              onClick={() => setDivision(opcion.dividida ? (division ?? DIVISION_INICIAL) : null)}
              className={`min-h-12 rounded-xl px-3 text-[15px] font-bold pulsable ${
                Boolean(division) === opcion.dividida
                  ? "bg-tinta text-white"
                  : "border border-filete bg-mantel text-tinta"
              }`}
            >
              {opcion.texto}
            </button>
          ))}
        </div>
      )}

      {division && <Division division={division} onCambiar={setDivision} unidades={unidades} reparto={reparto} />}

      <fieldset hidden={Boolean(division)}>
        <legend className="mb-2 font-titulo text-2xl font-semibold tracking-[-0.02em] text-tinta">¿Cómo pagan?</legend>
        <div className="grid grid-cols-3 gap-2">
          {METODOS_PAGO.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={metodo === opcion.valor}
              onClick={() => setMetodo(opcion.valor)}
              className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl px-2 text-[15px] font-bold pulsable ${
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
          disabled={Boolean(falta) || bloqueado}
          cargando={ocupado}
          onClick={confirmar}
        >
          {falta ??
            `Confirmar cobro de ${pesos(total)}${division ? ` en ${plural(reparto.pagos.length, "pago", "pagos")}` : ""}`}
        </Boton>
        <Boton variante="secundario" onClick={onVolver}>
          Volver a la cuenta
        </Boton>
      </div>
    </div>
  );
}
