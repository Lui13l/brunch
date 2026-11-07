import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso, Boton, Campo, Cargando, Casilla, Hoja, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useRecurso } from "../../hooks/useRecurso";

const VACIO = { numero: "", nombre: "", capacidad: "4", activa: true };

export default function MesasAdmin() {
  const { pedir } = useAuth();
  const { datos: mesas, error, setError, cargando, recargar } = useRecurso("/api/admin/mesas");
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
      <Aviso onReintentar={recargar}>{error}</Aviso>

      <Boton className="mb-4 flex w-full items-center justify-center gap-2" onClick={() => setEditando({ ...VACIO })}>
        <Plus size={18} /> Nueva mesa
      </Boton>

      {mesas.length === 0 ? (
        <Vacio>No hay mesas. Sin ellas el mesero no puede abrir cuentas.</Vacio>
      ) : (
        <ul className="space-y-2">
          {mesas.map((mesa) => (
            <li key={mesa.id} className="flex items-center gap-3 rounded-xl border border-filete bg-white p-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sala text-xl font-bold text-tinta">
                {mesa.numero}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-tinta">{mesa.nombre || `Mesa ${mesa.numero}`}</p>
                <p className="text-sm text-tinta-2">
                  {mesa.capacidad ? `${mesa.capacidad} personas` : "Sin capacidad definida"}
                  {!mesa.activa && ", fuera de servicio"}
                  {mesa.comandaAbiertaId && ", ocupada"}
                </p>
              </div>
              <button
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
                onClick={() => eliminar(mesa)}
                className="flex size-11 items-center justify-center rounded-lg text-brasa active:bg-brasa/8"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
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
            <Campo
              etiqueta="Capacidad"
              type="number"
              min="1"
              max="100"
              value={editando.capacidad}
              onChange={(e) => setEditando({ ...editando, capacidad: e.target.value })}
            />
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
