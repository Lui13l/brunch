import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { urlApi } from "../../lib/api";
import { reducirImagen } from "../../lib/imagenes";
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

// La foto del plato: se sube desde el equipo (queda guardada en la base) o se
// escribe la ruta de una que ya esté en la web.
function CampoImagen({ valor, onCambiar, onError }) {
  const { pedir } = useAuth();
  const [subiendo, setSubiendo] = useState(false);
  // Las fotos de la carta original ("/menu/…") son archivos de la web y aquí no
  // cargan: en vez de un icono roto se muestra el recuadro vacío.
  const [rota, setRota] = useState(null);
  const archivo = useRef(null);

  const elegir = async (e) => {
    const elegido = e.target.files?.[0];
    // Se vacía para que elegir otra vez el mismo archivo vuelva a avisar.
    e.target.value = "";
    if (!elegido) return;
    setSubiendo(true);
    onError("");
    try {
      const blob = await reducirImagen(elegido);
      const { url } = await pedir("/api/admin/imagenes", {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      onCambiar(url);
    } catch (err) {
      onError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const visible = valor && rota !== valor;

  return (
    <div>
      <span className="mb-1 block text-sm font-semibold text-tinta-2">Imagen</span>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        {visible ? (
          <img
            src={urlApi(valor)}
            alt="Vista previa de la foto del plato"
            onError={() => setRota(valor)}
            className="size-24 shrink-0 rounded-lg border border-filete object-cover"
          />
        ) : (
          <span className="flex size-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-filete px-2 text-center text-sm text-tinta-2">
            {valor ? "Sin vista previa" : "Sin foto"}
          </span>
        )}
        <div className="grid min-w-0 flex-1 gap-2">
          <input ref={archivo} type="file" accept="image/*" hidden onChange={elegir} />
          <Boton type="button" variante="secundario" cargando={subiendo} onClick={() => archivo.current?.click()}>
            <span className="flex items-center justify-center gap-2">
              <Upload size={18} aria-hidden /> Subir una foto
            </span>
          </Boton>
          {valor && (
            <Boton type="button" variante="secundario" disabled={subiendo} onClick={() => onCambiar("")}>
              Quitar foto
            </Boton>
          )}
        </div>
      </div>
      <Campo
        etiqueta="O su dirección"
        placeholder="/menu/pancakes.jpg"
        value={valor ?? ""}
        onChange={(e) => onCambiar(e.target.value)}
      />
    </div>
  );
}

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
            <CampoImagen
              valor={editando.imagenUrl}
              // La subida tarda: se aplica sobre el formulario de ese momento, no sobre el de cuando empezó.
              onCambiar={(imagenUrl) => setEditando((actual) => actual && { ...actual, imagenUrl })}
              onError={setError}
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
