import { useCallback, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import * as svc from "../../services/adminService";
import { Aviso, Campo, Cargando, Chip, Encabezado, Modal, Vacio } from "./comun";
import { useCarga } from "./util";

const VACIA = { nombre: "", descripcion: "", activa: true, palabras: "", respuestas: [""] };

// Intenciones del chatbot de la web: con qué palabras se activa y qué responde.
export default function AdminChatbot() {
  const cargar = useCallback(() => svc.listarIntenciones(), []);
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);
  const intenciones = datos ?? [];
  const [editando, setEditando] = useState(null);
  const [errorModal, setErrorModal] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrir = (i) =>
    setEditando(
      i
        ? {
            id: i._id,
            nombre: i.nombre,
            descripcion: i.descripcion ?? "",
            activa: i.activa !== false,
            palabras: (i.palabras_clave ?? []).join(", "),
            respuestas: (i.respuestas ?? []).map((r) => r.respuesta),
          }
        : { ...VACIA },
    );

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrorModal("");
    const cuerpo = {
      nombre: editando.nombre.trim(),
      descripcion: editando.descripcion.trim(),
      activa: editando.activa,
      palabras_clave: editando.palabras.split(",").map((p) => p.trim()).filter(Boolean),
      respuestas: editando.respuestas.map((r) => r.trim()).filter(Boolean).map((respuesta) => ({ tipo: "texto", respuesta })),
    };
    try {
      if (editando.id) await svc.editarIntencion(editando.id, cuerpo);
      else await svc.crearIntencion(cuerpo);
      setEditando(null);
      recargar();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (i) => {
    if (!window.confirm(`¿Eliminar la intención "${i.nombre}"?`)) return;
    try {
      await svc.eliminarIntencion(i._id);
      recargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const respuesta = (n, valor) => {
    const respuestas = [...editando.respuestas];
    respuestas[n] = valor;
    setEditando({ ...editando, respuestas });
  };

  return (
    <>
      <Encabezado
        titulo="Chatbot"
        descripcion="Cada intención se activa con sus palabras clave. Las respuestas pueden usar {nombre}, {menu}, {ultimo_pedido} y {mis_reservas}."
      >
        <button type="button" className="button adm-cafe" onClick={() => abrir(null)}>
          <Plus size={16} />
          <span>&nbsp;Nueva intención</span>
        </button>
      </Encabezado>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && intenciones.length === 0 && <Vacio>Aún no hay intenciones.</Vacio>}

      <ul className="adm-lista">
        {intenciones.map((i) => (
          <li key={i._id} className={`adm-tarjeta${i.activa === false ? " is-apagada" : ""}`}>
            <div className="adm-tarjeta-cabeza">
              <span className="adm-tarjeta-titulo">{i.nombre}</span>
              {i.activa === false && <Chip tono="apagado">Inactiva</Chip>}
              <span className="adm-tarjeta-meta">{(i.respuestas ?? []).length} respuesta(s)</span>
            </div>
            {i.descripcion && <p className="adm-tarjeta-meta">{i.descripcion}</p>}
            <p>{(i.palabras_clave ?? []).map((p) => <Chip key={p}>{p}</Chip>).reduce((acc, el) => [...acc, el, " "], [])}</p>
            <div className="adm-tarjeta-acciones">
              <button type="button" className="button is-small" onClick={() => abrir(i)}>
                <Pencil size={14} />
                <span>&nbsp;Editar</span>
              </button>
              <button type="button" className="button is-small" onClick={() => eliminar(i)}>
                <Trash2 size={14} />
                <span>&nbsp;Eliminar</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editando && (
        <Modal titulo={editando.id ? "Editar intención" : "Nueva intención"} error={errorModal} onCerrar={() => { setEditando(null); setErrorModal(""); }}>
          <form onSubmit={guardar}>
            <Campo etiqueta="Nombre"><input className="input" required value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Descripción"><input className="input" value={editando.descripcion} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} /></Campo>
            <Campo etiqueta="Palabras clave" ayuda="Separadas por comas. Sin tildes ni mayúsculas importa: se comparan normalizadas.">
              <input className="input" value={editando.palabras} onChange={(e) => setEditando({ ...editando, palabras: e.target.value })} />
            </Campo>
            {editando.respuestas.map((r, n) => (
              <Campo key={n} etiqueta={`Respuesta ${n + 1}`}>
                <textarea className="textarea" rows={2} required={n === 0} value={r} onChange={(e) => respuesta(n, e.target.value)} />
              </Campo>
            ))}
            <div className="field">
              <button type="button" className="button is-small" onClick={() => setEditando({ ...editando, respuestas: [...editando.respuestas, ""] })}>
                + Otra respuesta (se elige una al azar)
              </button>
            </div>
            <div className="field">
              <label className="checkbox">
                <input type="checkbox" checked={editando.activa} onChange={(e) => setEditando({ ...editando, activa: e.target.checked })} /> Activa
              </label>
            </div>
            <button type="submit" className={`button adm-cafe is-fullwidth${guardando ? " is-loading" : ""}`}>Guardar</button>
          </form>
        </Modal>
      )}
    </>
  );
}
