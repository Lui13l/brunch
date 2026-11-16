import { Pencil, Plus, RotateCw, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import MesaIlustracion from "../../components/MesaIlustracion";
import PlanoSalon from "../../components/PlanoSalon";
import { Aviso, Boton, Campo, Cargando, Casilla, Hoja, Selector, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useRecurso } from "../../hooks/useRecurso";
import { FORMAS, cabe, huella, primerHueco, ubicada } from "../../lib/plano";

const VACIO = { numero: "", nombre: "", capacidad: "4", forma: "cuadrada", activa: true };
const NOMBRE_FORMA = Object.fromEntries(FORMAS.map((f) => [f.valor, f.texto.toLowerCase()]));

const VISTAS = [
  { valor: "lista", texto: "Lista" },
  { valor: "plano", texto: "Plano del salón" },
];

export default function MesasAdmin() {
  const { pedir } = useAuth();
  const { datos: mesas, error, setError, cargando, recargar } = useRecurso("/api/admin/mesas");
  const [vista, setVista] = useState("lista");
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Al cerrar se descarta el error: si no, reaparecería al abrir el siguiente.
  const cerrarFormulario = () => {
    setEditando(null);
    setError("");
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      await pedir(editando.id ? `/api/admin/mesas/${editando.id}` : "/api/admin/mesas", {
        method: editando.id ? "PUT" : "POST",
        body: JSON.stringify({
          numero: Number(editando.numero),
          nombre: editando.nombre || null,
          capacidad: editando.capacidad ? Number(editando.capacidad) : null,
          forma: editando.forma,
          activa: editando.activa,
        }),
      });
      setEditando(null);
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (mesa) => {
    if (!window.confirm(`¿Eliminar la mesa ${mesa.numero}?`)) return;
    try {
      await pedir(`/api/admin/mesas/${mesa.id}`, { method: "DELETE" });
      recargar();
    } catch (err) {
      setError(err.message);
    }
  };

  if (cargando) return <Cargando />;

  return (
    <div className="p-4">
      <div role="tablist" aria-label="Vista de las mesas" className="mb-4 grid grid-cols-2 gap-2">
        {VISTAS.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            role="tab"
            aria-selected={vista === opcion.valor}
            onClick={() => setVista(opcion.valor)}
            className={`min-h-12 rounded-lg border-2 px-3 text-[15px] font-bold ${
              vista === opcion.valor ? "border-tinta bg-tinta text-white" : "border-filete bg-mantel text-tinta"
            }`}
          >
            {opcion.texto}
          </button>
        ))}
      </div>

      {!editando && <Aviso onReintentar={recargar}>{error}</Aviso>}

      {vista === "plano" ? (
        <EditorPlano
          // Se rehace cuando cambia lo guardado en el servidor: así el
          // borrador siempre parte del plano real.
          key={mesas.map((m) => `${m.id}:${m.x}:${m.y}:${m.rotacion}:${m.forma}:${m.capacidad}`).join("|")}
          mesas={mesas}
          pedir={pedir}
          onGuardado={recargar}
        />
      ) : (
        <>
          <Boton className="mb-4 flex w-full items-center justify-center gap-2" onClick={() => setEditando({ ...VACIO })}>
            <Plus size={18} /> Nueva mesa
          </Boton>

          {mesas.length === 0 ? (
            <Vacio>No hay mesas. Sin ellas el mesero no puede abrir cuentas.</Vacio>
          ) : (
            <ul className="space-y-2">
              {mesas.map((mesa) => (
                <li key={mesa.id} className="flex items-center gap-3 rounded-xl border border-filete bg-white p-3">
                  <span className="relative flex size-16 shrink-0 items-center justify-center text-tinta">
                    <MesaIlustracion
                      capacidad={mesa.capacidad}
                      forma={mesa.forma}
                      className="absolute inset-0 size-full text-tinta-2"
                    />
                    <span className="relative text-lg font-extrabold">{mesa.numero}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-tinta">{mesa.nombre || `Mesa ${mesa.numero}`}</p>
                    <p className="text-sm text-tinta-2">
                      {mesa.capacidad ? `${mesa.capacidad} personas` : "Sin capacidad definida"}, {NOMBRE_FORMA[mesa.forma]}
                      {!ubicada(mesa) && ", sin ubicar en el plano"}
                      {!mesa.activa && ", fuera de servicio"}
                      {mesa.comandaAbiertaId && ", ocupada"}
                    </p>
                  </div>
                  <button
                    aria-label={`Editar la mesa ${mesa.numero}`}
                    onClick={() =>
                      setEditando({
                        ...mesa,
                        numero: String(mesa.numero),
                        nombre: mesa.nombre ?? "",
                        capacidad: mesa.capacidad ? String(mesa.capacidad) : "",
                      })
                    }
                    className="flex size-11 items-center justify-center rounded-lg text-tinta-2 active:bg-sala"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    aria-label={`Eliminar la mesa ${mesa.numero}`}
                    onClick={() => eliminar(mesa)}
                    className="flex size-11 items-center justify-center rounded-lg text-brasa active:bg-brasa/8"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editando && (
        <Hoja
          titulo={editando.id ? `Mesa ${editando.numero}` : "Nueva mesa"}
          error={error}
          onCerrar={cerrarFormulario}
        >
          <form onSubmit={guardar} className="space-y-4">
            <Campo
              etiqueta="Número"
              type="number"
              required
              min="1"
              max="999"
              value={editando.numero}
              onChange={(e) => setEditando({ ...editando, numero: e.target.value })}
              ayuda="Es lo que el mesero canta a la cocina; no se puede repetir."
            />
            <Campo
              etiqueta="Nombre"
              maxLength={60}
              value={editando.nombre}
              onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
              ayuda="Opcional: «Terraza 1», «Barra»..."
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <div className="space-y-4">
                <Campo
                  etiqueta="Capacidad"
                  type="number"
                  min="1"
                  max="100"
                  value={editando.capacidad}
                  onChange={(e) => setEditando({ ...editando, capacidad: e.target.value })}
                />
                <Selector
                  etiqueta="Forma"
                  opciones={FORMAS}
                  value={editando.forma}
                  onChange={(e) => setEditando({ ...editando, forma: e.target.value })}
                  ayuda="Decide el dibujo y cuánto ocupa en el plano."
                />
              </div>
              {/* Así se verá en el salón: cambia al escribir la capacidad o elegir la forma. */}
              <MesaIlustracion
                capacidad={Number(editando.capacidad) || 1}
                forma={editando.forma}
                className="h-28 w-28 text-tinta"
              />
            </div>
            <Casilla
              etiqueta="En servicio"
              ayuda="Al desactivarla desaparece de la pantalla del mesero."
              checked={editando.activa}
              onChange={(e) => setEditando({ ...editando, activa: e.target.checked })}
            />
            <Boton type="submit" cargando={guardando} className="w-full">
              Guardar
            </Boton>
          </form>
        </Hoja>
      )}
    </div>
  );
}

// Armar el salón: cada mesa se arrastra a su lugar sobre la cuadrícula. Se
// trabaja sobre un borrador y nada cambia para los meseros hasta "Guardar plano".
function EditorPlano({ mesas, pedir, onGuardado }) {
  const [borrador, setBorrador] = useState(mesas);
  const [seleccion, setSeleccion] = useState(null);
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const plano = useRef(null);
  // Mesa de "Sin ubicar" que se está llevando al plano: va pegada al puntero.
  const tomada = useRef(null);
  const [flotante, setFlotante] = useState(null);

  const enPlano = borrador.filter(ubicada);
  const sinUbicar = borrador.filter((m) => !ubicada(m));
  const elegida = borrador.find((m) => m.id === seleccion);
  const hayCambios = borrador.some((m) => {
    const guardada = mesas.find((o) => o.id === m.id);
    return guardada.x !== m.x || guardada.y !== m.y || guardada.rotacion !== m.rotacion;
  });

  const cambiar = (id, cambios) => {
    setAviso("");
    setBorrador((previas) => previas.map((m) => (m.id === id ? { ...m, ...cambios } : m)));
  };
  const otras = (mesa) => enPlano.filter((m) => m.id !== mesa.id);

  const ubicar = (mesa) => {
    const hueco = primerHueco(mesa, enPlano);
    if (!hueco) return setAviso(`No queda espacio para la mesa ${mesa.numero}. Mueve o quita alguna.`);
    cambiar(mesa.id, hueco);
    setSeleccion(mesa.id);
  };

  // Arrastrar una mesa desde "Sin ubicar". Un toque sin mover sigue sirviendo
  // (y es lo que usa el teclado): la pone en el primer lugar libre.
  const alTomar = (evento, mesa) => {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    tomada.current = { id: mesa.id, x0: evento.clientX, y0: evento.clientY, arrastro: false };
  };
  const alLlevar = (evento, mesa) => {
    const agarre = tomada.current;
    if (agarre?.id !== mesa.id) return;
    if (!agarre.arrastro && Math.hypot(evento.clientX - agarre.x0, evento.clientY - agarre.y0) < 5) return;
    agarre.arrastro = true;
    const { celda } = plano.current.apuntar(mesa, evento.clientX, evento.clientY);
    setFlotante({ mesa, x: evento.clientX, y: evento.clientY, celda });
  };
  const alDejar = (mesa) => {
    const agarre = tomada.current;
    if (agarre?.id !== mesa.id) return;
    setFlotante(null);
    if (!agarre.arrastro) {
      tomada.current = null;
      return;
    }
    // Se deja marcado hasta el "click" que el navegador manda al soltar, para no
    // contarlo como toque.
    if (plano.current.soltar()) setSeleccion(mesa.id);
  };
  const alTocar = (mesa) => {
    const arrastro = tomada.current?.arrastro;
    tomada.current = null;
    if (!arrastro) ubicar(mesa);
  };

  const girar = (mesa) => {
    const girada = { ...mesa, rotacion: mesa.rotacion === 90 ? 0 : 90 };
    if (!cabe(girada, otras(mesa))) return setAviso(`Girada, la mesa ${mesa.numero} no cabe ahí. Muévela a un lugar con más espacio.`);
    cambiar(mesa.id, { rotacion: girada.rotacion });
  };

  const guardar = async () => {
    setGuardando(true);
    setAviso("");
    try {
      await pedir("/api/admin/mesas/plano", {
        method: "PUT",
        body: JSON.stringify({ mesas: borrador.map(({ id, x, y, rotacion }) => ({ id, x, y, rotacion })) }),
      });
      onGuardado();
    } catch (err) {
      setAviso(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (mesas.length === 0) return <Vacio>Primero crea las mesas en «Lista». Después las ubicas aquí.</Vacio>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="mx-auto w-full max-w-[40rem]">
        <PlanoSalon
          ref={plano}
          editable
          mesas={enPlano}
          seleccion={seleccion}
          pielDe={(mesa) => (mesa.activa ? "bg-white text-tinta" : "bg-espera text-tinta-2")}
          onPulsar={(mesa) => setSeleccion(mesa.id)}
          onMover={(mesa, x, y) => cambiar(mesa.id, { x, y })}
        />
        <p className="mt-2 text-[13px] text-tinta-2">
          Arrastra cada mesa a su lugar; las que faltan se arrastran desde «Sin ubicar». Con el teclado: elige una mesa y
          muévela con las flechas.
        </p>
      </div>

      <div className="space-y-4">
        <Aviso className="">{aviso}</Aviso>

        <section className="rounded-xl border border-filete bg-white p-3">
          <h3 className="text-[15px] font-extrabold text-tinta">
            {elegida ? `Mesa ${elegida.numero}` : "Ninguna mesa elegida"}
          </h3>
          {elegida ? (
            <>
              <p className="text-sm text-tinta-2">
                {elegida.capacidad} personas, {NOMBRE_FORMA[elegida.forma]}
                {!elegida.activa && ", fuera de servicio"}
              </p>
              <div className="mt-3 grid gap-2">
                {elegida.forma === "rectangular" && ubicada(elegida) && (
                  <Boton variante="secundario" onClick={() => girar(elegida)}>
                    <span className="flex items-center justify-center gap-2">
                      <RotateCw size={16} aria-hidden /> Girar
                    </span>
                  </Boton>
                )}
                {ubicada(elegida) && (
                  <Boton variante="secundario" onClick={() => cambiar(elegida.id, { x: null, y: null })}>
                    <span className="flex items-center justify-center gap-2">
                      <X size={16} aria-hidden /> Quitar del plano
                    </span>
                  </Boton>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-tinta-2">Toca una mesa del plano para girarla o quitarla.</p>
          )}
        </section>

        <section className="rounded-xl border border-filete bg-white p-3">
          <h3 className="text-[15px] font-extrabold text-tinta">Sin ubicar</h3>
          {sinUbicar.length === 0 ? (
            <p className="text-sm text-tinta-2">Todas las mesas están en el plano.</p>
          ) : (
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {sinUbicar.map((mesa) => (
                <li key={mesa.id}>
                  <button
                    type="button"
                    onClick={() => alTocar(mesa)}
                    onPointerDown={(evento) => alTomar(evento, mesa)}
                    onPointerMove={(evento) => alLlevar(evento, mesa)}
                    onPointerUp={() => alDejar(mesa)}
                    onPointerCancel={() => alDejar(mesa)}
                    className={`flex w-full cursor-grab touch-none items-center gap-2 rounded-lg border-2 border-filete bg-mantel p-2 text-left text-tinta transition-opacity ${
                      flotante?.mesa.id === mesa.id ? "opacity-40" : ""
                    }`}
                  >
                    <MesaIlustracion capacidad={mesa.capacidad} forma={mesa.forma} className="size-10 shrink-0 text-tinta-2" />
                    <span className="min-w-0">
                      <span className="block font-extrabold">Mesa {mesa.numero}</span>
                      <span className="block text-[13px] text-tinta-2">Arrástrala al plano</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Boton className="w-full" disabled={!hayCambios} cargando={guardando} onClick={guardar}>
          {hayCambios ? "Guardar plano" : "Plano guardado"}
        </Boton>
        {hayCambios && (
          <Boton variante="secundario" className="w-full" onClick={() => setBorrador(mesas)}>
            Descartar cambios
          </Boton>
        )}
      </div>

      {/* La mesa que va en el aire: pegada al puntero y del tamaño que tendrá en el plano. */}
      {flotante && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-105 -rotate-2 rounded-lg bg-white text-tinta shadow-xl"
          style={{
            left: flotante.x,
            top: flotante.y,
            width: huella(flotante.mesa).ancho * flotante.celda,
            height: huella(flotante.mesa).alto * flotante.celda,
          }}
        >
          <MesaIlustracion capacidad={flotante.mesa.capacidad} forma={flotante.mesa.forma} className="absolute inset-0 size-full" />
          <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold">{flotante.mesa.numero}</span>
        </div>
      )}
    </div>
  );
}
