import { useCallback, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import * as svc from "../../api/adminService";
import { Aviso, Campo, Cargando, Encabezado, Modal, Vacio } from "./comun";
import { useCarga } from "./util";

// Categorías de la carta y su orden en el menú.
export default function AdminCategorias() {
  const cargar = useCallback(() => Promise.all([svc.listarCategorias(), svc.listarPlatos()]), []);
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);
  const [categorias, platos] = datos ?? [[], []];
  const [editando, setEditando] = useState(null);
  const [errorModal, setErrorModal] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cuantos = (id) => platos.filter((p) => p.categoriaId === id).length;

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrorModal("");
    const cuerpo = { nombre: editando.nombre, orden: Number(editando.orden || 0) };
    try {
      if (editando.id) await svc.editarCategoria(editando.id, cuerpo);
      else await svc.crearCategoria(cuerpo);
      setEditando(null);
      recargar();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    try {
      await svc.eliminarCategoria(c.id);
      recargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <Encabezado titulo="Categorías" descripcion="Se muestran en el menú de menor a mayor orden. Solo se puede borrar una categoría vacía.">
        <button type="button" className="button adm-cafe" onClick={() => setEditando({ nombre: "", orden: categorias.length })}>
          <Plus size={16} />
          <span>&nbsp;Nueva categoría</span>
        </button>
      </Encabezado>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && categorias.length === 0 && <Vacio>Aún no hay categorías.</Vacio>}

      <div className="adm-tabla-wrap">
        <table className="table adm-tabla is-hoverable">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Nombre</th>
              <th>Platos</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id}>
                <td>{c.orden ?? 0}</td>
                <td><strong>{c.nombre}</strong></td>
                <td>{cuantos(c.id)}</td>
                <td className="has-text-right" style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="adm-boton-icono" aria-label={`Editar ${c.nombre}`} onClick={() => setEditando({ id: c.id, nombre: c.nombre, orden: c.orden ?? 0 })}>
                    <Pencil size={16} />
                  </button>{" "}
                  <button type="button" className="adm-boton-icono" aria-label={`Eliminar ${c.nombre}`} onClick={() => eliminar(c)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal titulo={editando.id ? "Editar categoría" : "Nueva categoría"} error={errorModal} onCerrar={() => { setEditando(null); setErrorModal(""); }}>
          <form onSubmit={guardar}>
            <Campo etiqueta="Nombre">
              <input className="input" required value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
            </Campo>
            <Campo etiqueta="Orden" ayuda="Menor número = aparece primero.">
              <input className="input" type="number" min="0" value={editando.orden} onChange={(e) => setEditando({ ...editando, orden: e.target.value })} />
            </Campo>
            <button type="submit" className={`button adm-cafe is-fullwidth${guardando ? " is-loading" : ""}`}>Guardar</button>
          </form>
        </Modal>
      )}
    </>
  );
}
