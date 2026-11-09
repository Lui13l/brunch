import { useCallback, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import * as svc from "../../services/adminService";
import { Aviso, Campo, Cargando, Encabezado, Modal, Selector, Vacio } from "./comun";
import { pesos, useCarga } from "./util";

// Dónde se vende, dicho como se diría en el restaurante.
const dondeSeOfrece = (p) => {
  if (!p.disponible) return "agotado";
  if (p.visibleWeb && p.visibleSalon) return "";
  if (p.visibleWeb) return "solo web";
  if (p.visibleSalon) return "solo salón";
  return "oculto";
};

const VACIO = {
  nombre: "",
  descripcion: "",
  precio: "",
  categoriaId: "",
  imagenUrl: "",
  tipo: "",
  disponible: true,
  visibleWeb: true,
  visibleSalon: true,
};

// Carta: lo que se vende en la web y en el salón (comandas).
export default function AdminMenu() {
  const cargar = useCallback(() => Promise.all([svc.listarPlatos(), svc.listarCategorias()]), []);
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);
  const [platos, categorias] = datos ?? [[], []];
  const [filtro, setFiltro] = useState({ categoria: "", texto: "" });
  const [editando, setEditando] = useState(null);
  const [errorModal, setErrorModal] = useState("");
  const [guardando, setGuardando] = useState(false);

  const texto = filtro.texto.trim().toLowerCase();
  const visibles = platos
    .filter((p) => !filtro.categoria || p.categoriaId === filtro.categoria)
    .filter((p) => !texto || p.nombre.toLowerCase().includes(texto));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrorModal("");
    const cuerpo = {
      ...editando,
      precio: Number(editando.precio),
      descripcion: editando.descripcion || null,
      imagenUrl: editando.imagenUrl || null,
      tipo: editando.tipo || null,
    };
    delete cuerpo.id;
    delete cuerpo.orden;
    try {
      if (editando.id) await svc.editarPlato(editando.id, cuerpo);
      else await svc.crearPlato(cuerpo);
      setEditando(null);
      recargar();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.nombre}" y su receta? Si solo quieres dejar de venderlo, desmarca "Disponible".`)) return;
    try {
      await svc.eliminarPlato(p.id);
      recargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const opcionesCategoria = categorias.map((c) => ({ valor: c.id ?? c._id, texto: c.nombre }));
  // La carta se lee por secciones, en el orden de las categorías.
  const secciones = [
    ...opcionesCategoria.map((categoria) => ({ categoria, platos: visibles.filter((p) => p.categoriaId === categoria.valor) })),
    { categoria: { valor: "sin", texto: "Sin categoría" }, platos: visibles.filter((p) => !opcionesCategoria.some((c) => c.valor === p.categoriaId)) },
  ].filter((sec) => sec.platos.length > 0);
  const campo = (k) => ({ value: editando[k] ?? "", onChange: (e) => setEditando({ ...editando, [k]: e.target.value }) });
  const casilla = (k) => ({ checked: Boolean(editando[k]), onChange: (e) => setEditando({ ...editando, [k]: e.target.checked }) });

  return (
    <>
      <Encabezado titulo="Menú" descripcion="Platos, precios y dónde se ofrecen (web y salón). Cada cambio queda en la auditoría.">
        <button type="button" className="button adm-cafe" onClick={() => setEditando({ ...VACIO, categoriaId: opcionesCategoria[0]?.valor ?? "" })}>
          <Plus size={16} />
          <span>&nbsp;Nuevo plato</span>
        </button>
      </Encabezado>

      <div className="adm-filtros">
        <Selector
          etiqueta="Categoría"
          opciones={[{ valor: "", texto: "Todas" }, ...opcionesCategoria]}
          value={filtro.categoria}
          onChange={(v) => setFiltro({ ...filtro, categoria: v })}
        />
        <Campo etiqueta="Buscar">
          <input className="input" type="search" placeholder="Nombre del plato" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} />
        </Campo>
      </div>

      <Aviso>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && visibles.length === 0 && <Vacio>No hay platos con estos filtros.</Vacio>}

      {visibles.length > 0 && (
        <div className="adm-carta">
          {secciones.map(({ categoria, platos: lista }) => (
            <section key={categoria.valor} className="adm-carta-seccion" aria-label={categoria.texto}>
              <h3 className="adm-carta-categoria">{categoria.texto}</h3>
              <ul>
                {lista.map((p) => (
                  <li key={p.id} className={`adm-carta-plato${p.disponible ? "" : " is-agotado"}`}>
                    <span className="adm-carta-nombre">{p.nombre}</span>
                    <span className="adm-carta-donde">{dondeSeOfrece(p)}</span>
                    <span className="adm-guia" aria-hidden="true" />
                    <span className="adm-carta-precio">{pesos(p.precio)}</span>
                    <span className="adm-carta-acciones">
                      <button type="button" className="adm-boton-icono" aria-label={`Editar ${p.nombre}`} title="Editar" onClick={() => setEditando({ ...VACIO, ...p, descripcion: p.descripcion ?? "", imagenUrl: p.imagenUrl ?? "" })}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="adm-boton-icono" aria-label={`Eliminar ${p.nombre}`} title="Eliminar" onClick={() => eliminar(p)}>
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editando && (
        <Modal titulo={editando.id ? "Editar plato" : "Nuevo plato"} error={errorModal} onCerrar={() => { setEditando(null); setErrorModal(""); }}>
          <form onSubmit={guardar}>
            <Campo etiqueta="Nombre"><input className="input" required {...campo("nombre")} /></Campo>
            <Campo etiqueta="Precio"><input className="input" type="number" min="0" step="100" required {...campo("precio")} /></Campo>
            <Selector etiqueta="Categoría" opciones={opcionesCategoria} value={editando.categoriaId} onChange={(v) => setEditando({ ...editando, categoriaId: v })} required />
            <Campo etiqueta="Descripción"><textarea className="textarea" rows={3} {...campo("descripcion")} /></Campo>
            <Campo etiqueta="Imagen (URL)" ayuda="Por ejemplo /menu/pancakes.jpg"><input className="input" {...campo("imagenUrl")} /></Campo>
            <div className="field">
              <label className="checkbox"><input type="checkbox" {...casilla("disponible")} /> Disponible (sin esto no se vende en ningún lado)</label>
            </div>
            <div className="field">
              <label className="checkbox"><input type="checkbox" {...casilla("visibleWeb")} /> Visible en la web</label>
            </div>
            <div className="field">
              <label className="checkbox"><input type="checkbox" {...casilla("visibleSalon")} /> Visible en el salón (comandas)</label>
            </div>
            <button type="submit" className={`button adm-cafe is-fullwidth${guardando ? " is-loading" : ""}`}>Guardar</button>
          </form>
        </Modal>
      )}
    </>
  );
}
