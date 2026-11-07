import { History, Pencil, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Aviso, Boton, Campo, Cargando, Casilla, Hoja, Selector, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useRecurso } from "../../hooks/useRecurso";
import { cantidad, UNIDADES } from "../../lib/formato";

const VACIO = { nombre: "", unidad: "UND", stock: "", stockMinimo: "0", activo: true };

export default function Insumos() {
  const { pedir } = useAuth();
  const { datos: insumos, error, setError, cargando, recargar } = useRecurso("/api/admin/insumos");
  const [editando, setEditando] = useState(null);
  const [ajustando, setAjustando] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Al cerrar se descarta el error: si no, reaparecería al abrir el siguiente.
  const cerrar = (set) => {
    set(null);
    setError("");
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const cuerpo = {
        nombre: editando.nombre,
        unidad: editando.unidad,
        stockMinimo: Number(editando.stockMinimo || 0),
        activo: editando.activo,
      };
      // El stock inicial solo se envía al crear: después se mueve con ajustes,
      // que quedan registrados en el libro.
      if (!editando.id) cuerpo.stock = Number(editando.stock || 0);

      await pedir(editando.id ? `/api/admin/insumos/${editando.id}` : "/api/admin/insumos", {
        method: editando.id ? "PUT" : "POST",
        body: JSON.stringify(cuerpo),
      });
      setEditando(null);
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const ajustar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const signo = ajustando.direccion === "salida" ? -1 : 1;
      await pedir(`/api/admin/insumos/${ajustando.insumo.id}/ajuste`, {
        method: "POST",
        body: JSON.stringify({
          cantidad: signo * Number(ajustando.cantidad),
          tipo: ajustando.tipo,
          motivo: ajustando.motivo || null,
        }),
      });
      setAjustando(null);
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const verHistorial = async (insumo) => {
    setHistorial({ insumo, movimientos: null });
    try {
      const movimientos = await pedir(`/api/admin/insumos/${insumo.id}/movimientos`);
      setHistorial({ insumo, movimientos });
    } catch (err) {
      setError(err.message);
      setHistorial(null);
    }
  };

  if (cargando) return <Cargando />;

  return (
    <div className="p-4">
      <Aviso onReintentar={recargar}>{error}</Aviso>

      <Boton className="mb-4 flex w-full items-center justify-center gap-2" onClick={() => setEditando({ ...VACIO })}>
        <Plus size={18} /> Nuevo insumo
      </Boton>

      {insumos.length === 0 ? (
        <Vacio>Aún no hay insumos. Sin ellos las recetas no descuentan nada.</Vacio>
      ) : (
        <ul className="space-y-2">
          {insumos.map((insumo) => (
            <li
              key={insumo.id}
              className={`rounded-xl border bg-white p-3 ${
                insumo.stock < 0 ? "border-brasa" : insumo.bajoMinimo ? "border-tibio" : "border-filete"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">
                    {insumo.nombre}
                    {!insumo.activo && <span className="ml-2 text-xs font-normal text-tinta-2">(inactivo)</span>}
                  </p>
                  <p className="text-sm text-tinta-2">
                    {cantidad(insumo.stock)} {insumo.unidad}, mínimo {cantidad(insumo.stockMinimo)}
                  </p>
                  {insumo.stock < 0 && (
                    <p className="text-sm font-semibold text-brasa">En negativo: se vendió sin existencias</p>
                  )}
                  {insumo.stock >= 0 && insumo.bajoMinimo && (
                    <p className="text-sm font-semibold text-rio">Bajo el mínimo</p>
                  )}
                </div>
                <button
                  onClick={() => verHistorial(insumo)}
                  title="Movimientos"
                  className="flex size-11 items-center justify-center rounded-lg text-tinta-2 active:bg-sala"
                >
                  <History size={18} />
                </button>
                <button
                  onClick={() => setEditando({ ...insumo, stockMinimo: String(insumo.stockMinimo) })}
                  className="flex size-11 items-center justify-center rounded-lg text-tinta-2 active:bg-sala"
                >
                  <Pencil size={18} />
                </button>
              </div>

              <div className="mt-2 flex gap-2">
                <Boton
                  variante="secundario"
                  className="flex flex-1 items-center justify-center gap-2 text-sm"
                  onClick={() => setAjustando({ insumo, direccion: "entrada", tipo: "COMPRA", cantidad: "", motivo: "" })}
                >
                  <TrendingUp size={16} /> Entrada
                </Boton>
                <Boton
                  variante="secundario"
                  className="flex flex-1 items-center justify-center gap-2 text-sm"
                  onClick={() => setAjustando({ insumo, direccion: "salida", tipo: "AJUSTE", cantidad: "", motivo: "" })}
                >
                  <TrendingDown size={16} /> Merma
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <Hoja
          titulo={editando.id ? "Editar insumo" : "Nuevo insumo"}
          error={error}
          onCerrar={() => cerrar(setEditando)}
        >
          <form onSubmit={guardar} className="space-y-4">
            <Campo
              etiqueta="Nombre"
              required
              maxLength={255}
              value={editando.nombre}
              onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
            />
            <Selector
              etiqueta="Unidad"
              value={editando.unidad}
              onChange={(e) => setEditando({ ...editando, unidad: e.target.value })}
              opciones={UNIDADES}
              ayuda="Las recetas usan esta misma unidad."
            />
            {!editando.id && (
              <Campo
                etiqueta="Stock inicial"
                type="number"
                min="0"
                step="0.001"
                value={editando.stock}
                onChange={(e) => setEditando({ ...editando, stock: e.target.value })}
                ayuda="Entra como movimiento de compra, para que el libro cuadre desde el principio."
              />
            )}
            <Campo
              etiqueta="Stock mínimo"
              type="number"
              min="0"
              step="0.001"
              value={editando.stockMinimo}
              onChange={(e) => setEditando({ ...editando, stockMinimo: e.target.value })}
              ayuda="Por debajo de aquí se marca en la lista."
            />
            <Casilla
              etiqueta="Activo"
              checked={editando.activo}
              onChange={(e) => setEditando({ ...editando, activo: e.target.checked })}
            />
            <Boton type="submit" cargando={guardando} className="w-full">
              Guardar
            </Boton>
          </form>
        </Hoja>
      )}

      {ajustando && (
        <Hoja
          titulo={`${ajustando.direccion === "entrada" ? "Entrada de" : "Merma de"} ${ajustando.insumo.nombre}`}
          error={error}
          onCerrar={() => cerrar(setAjustando)}
        >
          <form onSubmit={ajustar} className="space-y-4">
            <Campo
              etiqueta={`Cantidad (${ajustando.insumo.unidad})`}
              type="number"
              required
              min="0.001"
              step="0.001"
              autoFocus
              value={ajustando.cantidad}
              onChange={(e) => setAjustando({ ...ajustando, cantidad: e.target.value })}
            />
            {ajustando.direccion === "entrada" && (
              <Selector
                etiqueta="Tipo"
                value={ajustando.tipo}
                onChange={(e) => setAjustando({ ...ajustando, tipo: e.target.value })}
                opciones={[
                  { valor: "COMPRA", texto: "Compra a proveedor" },
                  { valor: "AJUSTE", texto: "Corrección de conteo" },
                ]}
              />
            )}
            <Campo
              etiqueta="Motivo"
              required={ajustando.tipo === "AJUSTE"}
              value={ajustando.motivo}
              onChange={(e) => setAjustando({ ...ajustando, motivo: e.target.value })}
              ayuda={ajustando.tipo === "AJUSTE" ? "Obligatorio: una corrección sin motivo no se puede auditar." : undefined}
            />
            <Boton type="submit" cargando={guardando} className="w-full">
              Registrar
            </Boton>
          </form>
        </Hoja>
      )}

      {historial && (
        <Hoja titulo={`Movimientos de ${historial.insumo.nombre}`} onCerrar={() => setHistorial(null)}>
          {!historial.movimientos ? (
            <Cargando />
          ) : historial.movimientos.length === 0 ? (
            <Vacio>Sin movimientos todavía.</Vacio>
          ) : (
            <ul className="divide-y divide-filete">
              {historial.movimientos.map((mv) => (
                <li key={mv.id} className="flex items-baseline justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-tinta">{mv.tipo}</p>
                    <p className="text-xs text-tinta-2">
                      {mv.fecha?.replace("T", " ").slice(0, 16)}
                      {mv.motivo && `, ${mv.motivo}`}
                      {mv.comandaItemId && ", venta en mesa"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${mv.cantidad < 0 ? "text-brasa" : "text-listo"}`}>
                      {mv.cantidad > 0 ? "+" : ""}
                      {cantidad(mv.cantidad)}
                    </p>
                    <p className="text-xs text-tinta-2">queda {cantidad(mv.stockResultante)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Hoja>
      )}
    </div>
  );
}
