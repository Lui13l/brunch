import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso, Boton, Campo, Cargando, Hoja, Selector, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useRecurso } from "../../hooks/useRecurso";

export default function Recetas() {
  const { pedir } = useAuth();
  const { datos, error, setError, cargando, recargar } = useRecurso([
    "/api/admin/menu",
    "/api/admin/insumos",
    "/api/admin/recetas/faltantes",
  ]);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [platos, insumos, sinReceta] = datos ?? [[], [], []];
  const idsSinReceta = new Set(sinReceta.map((p) => p.id));
  const disponibles = insumos.filter((i) => i.activo);

  const abrir = async (plato) => {
    setEditando({ plato, lineas: null });
    try {
      const { receta } = await pedir(`/api/admin/recetas/${plato.id}`);
      setEditando({
        plato,
        lineas: receta.map((r) => ({ insumoId: String(r.insumoId), cantidad: String(r.cantidad) })),
      });
    } catch (err) {
      setError(err.message);
      setEditando(null);
    }
  };

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
      await pedir(`/api/admin/recetas/${editando.plato.id}`, {
        method: "PUT",
        body: JSON.stringify({
          items: editando.lineas
            .filter((l) => l.insumoId && l.cantidad)
            .map((l) => ({ insumoId: String(l.insumoId), cantidad: Number(l.cantidad) })),
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

  const cambiarLinea = (i, campo, valor) =>
    setEditando((prev) => ({
      ...prev,
      lineas: prev.lineas.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)),
    }));

  const unidadDe = (insumoId) => insumos.find((i) => String(i.id) === String(insumoId))?.unidad ?? "";

  if (cargando) return <Cargando />;

  return (
    <div className="p-4">
      <Aviso onReintentar={recargar}>{error}</Aviso>

      {sinReceta.length > 0 && (
        <div className="mb-4 flex gap-3 rounded-xl border border-tibio bg-tibio/15 p-3">
          <AlertTriangle className="shrink-0 text-rio" size={20} />
          <p className="text-sm text-tinta">
            <strong>{sinReceta.length} plato(s) sin receta.</strong> Se pueden vender, pero no descuentan inventario.
          </p>
        </div>
      )}

      {platos.length === 0 ? (
        <Vacio>Primero crea platos en la carta.</Vacio>
      ) : (
        <ul className="space-y-2">
          {platos.map((plato) => (
            <li key={plato.id}>
              <button
                onClick={() => abrir(plato)}
                className="flex w-full items-center gap-3 rounded-xl border border-filete bg-white p-3 text-left active:bg-sala"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">{plato.nombre}</p>
                  <p className={`text-sm ${idsSinReceta.has(plato.id) ? "text-rio" : "text-tinta-2"}`}>
                    {idsSinReceta.has(plato.id) ? "Sin receta" : "Receta definida"}
                  </p>
                </div>
                <span className="text-filete">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <Hoja titulo={`Receta de ${editando.plato.nombre}`} error={error} onCerrar={cerrarFormulario}>
          {!editando.lineas ? (
            <Cargando />
          ) : (
            <form onSubmit={guardar} className="space-y-4">
              <p className="text-sm text-tinta-2">
                Cantidad que gasta <strong>una unidad</strong> del plato. Se descuenta al enviar a cocina.
              </p>

              {editando.lineas.length === 0 && <Vacio>Sin insumos: este plato no descuenta nada.</Vacio>}

              {editando.lineas.map((linea, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Selector
                    etiqueta="Insumo"
                    className="flex-1"
                    required
                    value={linea.insumoId}
                    onChange={(e) => cambiarLinea(i, "insumoId", e.target.value)}
                    opciones={[
                      { valor: "", texto: "Elige un insumo" },
                      ...disponibles.map((ins) => ({ valor: ins.id, texto: `${ins.nombre} (${ins.unidad})` })),
                    ]}
                  />
                  <Campo
                    etiqueta={unidadDe(linea.insumoId) || "Cantidad"}
                    className="w-28"
                    type="number"
                    required
                    min="0.001"
                    step="0.001"
                    value={linea.cantidad}
                    onChange={(e) => cambiarLinea(i, "cantidad", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditando((prev) => ({ ...prev, lineas: prev.lineas.filter((_, idx) => idx !== i) }))
                    }
                    className="flex size-12 shrink-0 items-center justify-center rounded-lg text-brasa active:bg-brasa/8"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              <Boton
                type="button"
                variante="secundario"
                className="flex w-full items-center justify-center gap-2"
                onClick={() =>
                  setEditando((prev) => ({ ...prev, lineas: [...prev.lineas, { insumoId: "", cantidad: "" }] }))
                }
              >
                <Plus size={18} /> Agregar insumo
              </Boton>

              <Boton type="submit" cargando={guardando} className="w-full">
                Guardar receta
              </Boton>
            </form>
          )}
        </Hoja>
      )}
    </div>
  );
}
