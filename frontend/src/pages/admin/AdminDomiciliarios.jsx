import { useCallback, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import * as svc from "../../services/adminService";
import { Aviso, Campo, Cargando, Chip, Encabezado, Modal, Selector, Vacio } from "./comun";
import { useCarga } from "./util";

const ESTADOS = {
  disponible: { texto: "Disponible", tono: "ok" },
  ocupado: { texto: "En ruta", tono: "proceso" },
  inactivo: { texto: "Inactivo", tono: "apagado" },
};

// Domiciliarios que se asignan a los pedidos web.
export default function AdminDomiciliarios() {
  const [estado, setEstado] = useState("");
  const cargar = useCallback(() => svc.listarDomiciliarios({ estado }), [estado]);
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);
  const lista = datos ?? [];
  const [editando, setEditando] = useState(null);
  const [errorModal, setErrorModal] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrorModal("");
    const cuerpo = { nombre: editando.nombre, apellido: editando.apellido };
    try {
      if (editando._id) await svc.editarDomiciliario(editando._id, cuerpo);
      else await svc.crearDomiciliario(cuerpo);
      setEditando(null);
      recargar();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (d, nuevo) => {
    try {
      await svc.cambiarEstadoDomiciliario(d._id, nuevo);
      recargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <Encabezado titulo="Domiciliarios" descripcion="Quedan en ruta al asignarlos a un pedido y vuelven a disponibles al entregarlo o cancelarlo.">
        <button type="button" className="button adm-cafe" onClick={() => setEditando({ nombre: "", apellido: "" })}>
          <Plus size={16} />
          <span>&nbsp;Nuevo domiciliario</span>
        </button>
      </Encabezado>

      <div className="adm-filtros">
        <Selector
          etiqueta="Estado"
          opciones={[{ valor: "", texto: "Todos" }, ...Object.entries(ESTADOS).map(([valor, e]) => ({ valor, texto: e.texto }))]}
          value={estado}
          onChange={setEstado}
        />
      </div>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && lista.length === 0 && <Vacio>No hay domiciliarios con este filtro.</Vacio>}

      <ul className="adm-lista">
        {lista.map((d) => {
          const e = ESTADOS[d.estado] ?? { texto: d.estado, tono: "neutro" };
          return (
            <li key={d._id} className={`adm-tarjeta${d.estado === "inactivo" ? " is-apagada" : ""}`}>
              <div className="adm-tarjeta-cabeza">
                <span className="adm-tarjeta-titulo">{d.nombre} {d.apellido}</span>
                <Chip tono={e.tono}>{e.texto}</Chip>
              </div>
              <div className="adm-tarjeta-acciones">
                <button type="button" className="button is-small" onClick={() => setEditando({ _id: d._id, nombre: d.nombre, apellido: d.apellido })}>
                  <Pencil size={14} />
                  <span>&nbsp;Editar</span>
                </button>
                {d.estado === "inactivo" ? (
                  <button type="button" className="button is-small adm-cafe" onClick={() => cambiarEstado(d, "disponible")}>Reactivar</button>
                ) : (
                  d.estado === "disponible" && (
                    <button type="button" className="button is-small" onClick={() => cambiarEstado(d, "inactivo")}>Desactivar</button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editando && (
        <Modal titulo={editando._id ? "Editar domiciliario" : "Nuevo domiciliario"} error={errorModal} onCerrar={() => { setEditando(null); setErrorModal(""); }}>
          <form onSubmit={guardar}>
            <Campo etiqueta="Nombre"><input className="input" required value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Apellido"><input className="input" required value={editando.apellido} onChange={(e) => setEditando({ ...editando, apellido: e.target.value })} /></Campo>
            <button type="submit" className={`button adm-cafe is-fullwidth${guardando ? " is-loading" : ""}`}>Guardar</button>
          </form>
        </Modal>
      )}
    </>
  );
}
