import { useMemo, useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { Boton } from "../ui";
import { pesos, sinTildes } from "../../lib/formato";

// La carta para agregar platos a una cuenta. Arriba va el buscador: con la
// carta larga, escribir "panc" es más rápido que recorrer categorías. Al
// buscar se mira en toda la carta, no solo en la categoría abierta.
//
// Un plato agotado (le falta algún insumo de su receta) no se puede agregar:
// se ve qué le falta y sus botones quedan apagados hasta que vuelva a haber
// inventario. Lo que ya estaba por enviar sí se puede quitar.
//
// Cada plato lleva su contador: cuántas unidades hay por enviar, con menos y
// más al lado, para pedir tres cafés sin salir de la carta.
export default function Carta({ carta, enCuenta, onAgregar, onQuitar, onCerrar, onCobrar, ocupado }) {
  const [categoria, setCategoria] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const termino = sinTildes(busqueda.trim());
  const activa = carta.find((c) => c.id === categoria) ?? carta[0];

  const platos = useMemo(() => {
    if (!termino) return activa?.items ?? [];
    return carta.flatMap((c) =>
      c.items.filter((p) => sinTildes(p.nombre).includes(termino)).map((p) => ({ ...p, categoria: c.nombre })),
    );
  }, [carta, activa, termino]);

  return (
    <div className="p-4 pb-28">
      <label className="relative mb-3 block">
        <span className="sr-only">Buscar un plato</span>
        <Search size={20} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-tinta-2" />
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Buscar un plato"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="min-h-13 w-full rounded-xl border border-filete bg-mantel pr-12 pl-11 text-[17px] text-tinta outline-none placeholder:text-tinta-2 focus:border-caramelo [&::-webkit-search-cancel-button]:hidden"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda("")}
            aria-label="Borrar la búsqueda"
            className="absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-tinta-2 active:bg-sala"
          >
            <X size={18} />
          </button>
        )}
      </label>

      {!termino && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {carta.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={`min-h-11 shrink-0 rounded-lg px-4 font-bold transition ${
                activa?.id === c.id ? "bg-rio text-white" : "border border-filete bg-mantel text-tinta active:bg-sala"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {termino && (
        <p className="mb-3 text-[15px] font-semibold text-tinta-2" role="status">
          {platos.length === 0
            ? `Ningún plato coincide con «${busqueda.trim()}».`
            : `${platos.length} ${platos.length === 1 ? "plato" : "platos"} en toda la carta`}
        </p>
      )}

      {platos.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-filete bg-mantel">
          {platos.map((plato) => {
            const pedidos = enCuenta.get(plato.id) ?? 0;
            return (
              <li key={plato.id} className="flex items-stretch border-b border-filete last:border-0">
                {/* Tocar el nombre también suma uno: es el blanco más grande de la fila. */}
                <button
                  disabled={ocupado || plato.agotado}
                  onClick={() => onAgregar(plato)}
                  aria-label={`Agregar ${plato.nombre}`}
                  className="min-w-0 flex-1 py-4 pr-2 pl-4 text-left active:bg-sala disabled:cursor-not-allowed"
                >
                  <p className={`flex flex-wrap items-center gap-2 text-[17px] font-bold ${plato.agotado ? "text-tinta-2" : "text-tinta"}`}>
                    {plato.nombre}
                    {plato.agotado && (
                      <span className="rounded bg-brasa px-2 py-0.5 text-[13px] font-extrabold text-white">Agotado</span>
                    )}
                  </p>
                  <p className="text-[15px] font-semibold text-tinta-2">
                    {pesos(plato.precio)}
                    {plato.categoria && `, ${plato.categoria}`}
                  </p>
                  {plato.agotado && (
                    <p className="mt-0.5 text-[14px] font-semibold text-brasa">Falta: {plato.faltan.join(", ")}</p>
                  )}
                </button>

                <div
                  className="flex shrink-0 items-center gap-1.5 py-3 pr-4"
                  role="group"
                  aria-label={`Unidades de ${plato.nombre} por enviar`}
                >
                  {pedidos > 0 && (
                    <>
                      <button
                        disabled={ocupado}
                        onClick={() => onQuitar(plato)}
                        aria-label={`Quitar uno de ${plato.nombre}`}
                        className="flex size-11 items-center justify-center rounded-lg border border-filete text-tinta pulsable disabled:opacity-50"
                      >
                        <Minus size={20} />
                      </button>
                      <span
                        aria-live="polite"
                        className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-tibio px-2 text-lg font-extrabold text-tinta tabular-nums"
                      >
                        {pedidos}
                      </span>
                    </>
                  )}
                  <button
                    disabled={ocupado || plato.agotado}
                    onClick={() => onAgregar(plato)}
                    aria-label={`Sumar uno de ${plato.nombre}`}
                    title={plato.agotado ? "Agotado: falta inventario" : undefined}
                    className="flex size-11 items-center justify-center rounded-lg bg-rio text-white pulsable disabled:cursor-not-allowed disabled:bg-filete disabled:text-tinta-2"
                  >
                    <Plus size={22} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-filete bg-mantel px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
          Volver a la cuenta
        </Boton>
        <Boton variante="marca" className="flex-1" onClick={onCobrar}>
          Cerrar mesa
        </Boton>
      </div>
    </div>
  );
}
