import { useCallback, useState } from "react";
import * as svc from "../../api/adminService";
import { useAuth } from "../../context/AuthContext";
import { Aviso, Campo, Cargando, Chip, Encabezado, Selector, Vacio } from "./comun";
import { fechaCorta, useCarga } from "./util";

const ROLES = [
  { valor: "admin", texto: "Administración" },
  { valor: "mesero", texto: "Mesero" },
  { valor: "cocina", texto: "Cocina" },
  { valor: "cliente", texto: "Cliente" },
];
const NOMBRE_ROL = Object.fromEntries(ROLES.map((r) => [r.valor, r.texto]));

// Clientes y personal. Cambiar el rol o desactivar una cuenta cierra su sesión
// en vivo; nadie puede cambiarse a sí mismo ni dejar el sistema sin admin.
export default function AdminUsuarios() {
  const { user } = useAuth();
  const [rol, setRol] = useState("");
  const [buscar, setBuscar] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState("");
  const cargar = useCallback(() => svc.listarUsuarios(rol ? { rol_id: rol } : {}), [rol]);
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);

  const texto = buscar.trim().toLowerCase();
  const usuarios = (datos ?? []).filter((u) => !texto || `${u.nombre} ${u.correo}`.toLowerCase().includes(texto));
  const yo = (u) => (u.id ?? u._id) === (user.id ?? user._id);

  const ejecutar = async (u, accion, mensaje) => {
    setOcupado(u._id);
    setError("");
    setAviso("");
    try {
      await accion();
      setAviso(mensaje);
      await recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  };

  const cambiarRol = (u, nuevo) => {
    if (nuevo === u.rol_id) return;
    if (!window.confirm(`¿Cambiar el rol de ${u.nombre} a ${NOMBRE_ROL[nuevo]}? Se cerrará su sesión.`)) return;
    ejecutar(u, () => svc.cambiarRolUsuario(u._id, nuevo), `${u.nombre} ahora es ${NOMBRE_ROL[nuevo]}.`);
  };

  const alternarActivo = (u) => {
    const activo = u.activo === false;
    if (!activo && !window.confirm(`¿Desactivar la cuenta de ${u.nombre}? Se cerrará su sesión en todos los dispositivos.`)) return;
    ejecutar(u, () => svc.cambiarActivoUsuario(u._id, activo), `Cuenta de ${u.nombre} ${activo ? "reactivada" : "desactivada"}.`);
  };

  return (
    <>
      <Encabezado
        titulo="Usuarios y roles"
        descripcion="Las cuentas de mesero y cocina se crean desde la app de comandas (Administración → Personal)."
      />

      <div className="adm-filtros">
        <Selector etiqueta="Rol" opciones={[{ valor: "", texto: "Todos" }, ...ROLES]} value={rol} onChange={setRol} />
        <Campo etiqueta="Buscar">
          <input className="input" type="search" placeholder="Nombre o correo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </Campo>
      </div>

      <Aviso tipo="ok" onCerrar={() => setAviso("")}>{aviso}</Aviso>
      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && usuarios.length === 0 && <Vacio>No hay usuarios con estos filtros.</Vacio>}

      <div className="adm-tabla-wrap">
        <table className="table adm-tabla is-hoverable">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u._id} style={u.activo === false ? { opacity: 0.55 } : undefined}>
                <td>
                  <strong>{u.nombre}</strong> {yo(u) && <Chip>Tú</Chip>}
                  <br />
                  <span className="adm-tarjeta-meta">{u.correo}</span>
                  <br />
                  <span className="adm-tarjeta-meta">Desde {fechaCorta(u.createdAt)}</span>
                </td>
                <td>
                  <div className="select is-small">
                    <select
                      aria-label={`Rol de ${u.nombre}`}
                      value={u.rol_id}
                      disabled={yo(u) || ocupado === u._id}
                      onChange={(e) => cambiarRol(u, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.valor} value={r.valor}>{r.texto}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>{u.activo === false ? <Chip tono="apagado">Desactivada</Chip> : <Chip tono="ok">Activa</Chip>}</td>
                <td className="has-text-right">
                  {!yo(u) && (
                    <button type="button" className={`button is-small${ocupado === u._id ? " is-loading" : ""}`} disabled={ocupado === u._id} onClick={() => alternarActivo(u)}>
                      {u.activo === false ? "Reactivar" : "Desactivar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
