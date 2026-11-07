import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AreaTexto, Aviso, Boton, Campo, Cargando, Casilla, Hoja, Selector, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useRecurso } from "../../hooks/useRecurso";
import { pesos } from "../../lib/formato";

const VACIO = {
  nombre: "",
  descripcion: "",
  precio: "",
  categoriaId: "",
  disponible: true,
  visibleWeb: true,
  visibleSalon: true,
  imagenUrl: "",
};

export default function Platos() {
  const { pedir } = useAuth();
  const { datos, error, setError, cargando, recargar } = useRecurso(["/api/admin/menu", "/api/categorias"]);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [platos, categorias] = datos ?? [[], []];

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
      const cuerpo = {
        ...editando,
        precio: Number(editando.precio),
        categoriaId: editando.categoriaId || null,
        descripcion: editando.descripcion || null,
        imagenUrl: editando.imagenUrl || null,
      };
      delete cuerpo.id;
      await pedir(editando.id ? `/api/admin/menu/${editando.id}` : "/api/admin/menu", {
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

  const eliminar = async (plato) => {
    if (!window.confirm(`¿Eliminar "${plato.nombre}"? Las ventas ya registradas se conservan.`)) return;
    try {
      await pedir(`/api/admin/menu/${plato.id}`, { method: "DELETE" });
      recargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const nombreCategoria = (id) => categorias.find((c) => c.id === id)?.nombre ?? "—";

  if (cargando) return <Cargando />;

  return (
    <div className="p-4">
      <Aviso onReintentar={recargar}>{error}</Aviso>

      <Boton className="mb-4 flex w-full items-center justify-center gap-2" onClick={() => setEditando({ ...VACIO })}>
        <Plus size={18} /> Nuevo plato
      </Boton>

      {platos.length === 0 ? (
        <Vacio>Todavía no hay platos en la carta.</Vacio>
      ) : (
        <ul className="space-y-2">
          {platos.map((plato) => (
            <li key={plato.id} className="flex items-center gap-3 rounded-xl border border-filete bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-tinta">{plato.nombre}</p>
                <p className="text-sm text-tinta-2">
                  {pesos(plato.precio)} en {nombreCategoria(plato.categoriaId)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  {!plato.disponible && (
                    <span className="rounded bg-filete px-1.5 py-0.5 text-tinta-2">Agotado</span>
                  )}
                  {plato.visibleWeb && <span className="rounded bg-rio/12 px-1.5 py-0.5 text-rio">Web</span>}
                  {plato.visibleSalon && (
                    <span className="rounded bg-tibio/20 px-1.5 py-0.5 text-tinta">Salón</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setEditando({ ...VACIO, ...plato, descripcion: plato.descripcion ?? "", imagenUrl: plato.imagenUrl ?? "" })}
                className="flex size-11 items-center justify-center rounded-lg text-tinta-2 active:bg-sala"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={() => eliminar(plato)}
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
          titulo={editando.id ? "Editar plato" : "Nuevo plato"}
          error={error}
          onCerrar={cerrarFormulario}
        >
          <form onSubmit={guardar} className="space-y-4">
            <Campo
              etiqueta="Nombre"
              required
              maxLength={255}
              value={editando.nombre}
              onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
            />
            <Campo
              etiqueta="Precio"
              type="number"
              required
              min="0"
              step="100"
              value={editando.precio}
              onChange={(e) => setEditando({ ...editando, precio: e.target.value })}
            />
            <Selector
              etiqueta="Categoría"
              required
              value={editando.categoriaId}
              onChange={(e) => setEditando({ ...editando, categoriaId: e.target.value })}
              opciones={[
                { valor: "", texto: "Elige una categoría" },
                ...categorias.map((c) => ({ valor: c.id, texto: c.nombre })),
              ]}
            />
            <AreaTexto
              etiqueta="Descripción"
              value={editando.descripcion}
              onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
            />
            <Campo
              etiqueta="Imagen (URL)"
              value={editando.imagenUrl}
              onChange={(e) => setEditando({ ...editando, imagenUrl: e.target.value })}
            />

            <div className="space-y-1 border-t border-filete pt-3">
              <Casilla
                etiqueta="Disponible"
                ayuda="Sin esto no se puede vender en ningún sitio."
                checked={editando.disponible}
                onChange={(e) => setEditando({ ...editando, disponible: e.target.checked })}
              />
              <Casilla
                etiqueta="Visible en la web"
                checked={editando.visibleWeb}
                onChange={(e) => setEditando({ ...editando, visibleWeb: e.target.checked })}
              />
              <Casilla
                etiqueta="Visible en el salón"
                ayuda="Aparece en la carta del mesero."
                checked={editando.visibleSalon}
                onChange={(e) => setEditando({ ...editando, visibleSalon: e.target.checked })}
              />
            </div>

            <Boton type="submit" cargando={guardando} className="w-full">
              Guardar
            </Boton>
          </form>
        </Hoja>
      )}
    </div>
  );
}
