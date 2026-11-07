import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Aviso, Boton, Campo, Cargando, Casilla, Hoja, Selector, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useRecurso } from "../../hooks/useRecurso";
import { NOMBRE_ROL, OPCIONES_ROL, ROLES_NUEVA_CUENTA, fechaHora } from "../../lib/formato";

const FILTROS_ROL = [{ valor: "", texto: "Todo el personal" }, ...OPCIONES_ROL];
const CUENTA_VACIA = { nombre: "", email: "", password: "", rol: "MESERO" };

// Cuentas del personal: crear meseros y cocina, cambiar roles, desactivar
// cuentas y poner contraseñas. Desactivar o cambiar el rol cierra la sesión
// de esa persona en todos sus dispositivos.
export default function Personal() {
  const { user, pedir } = useAuth();
  const [rol, setRol] = useState("");
  const [soloActivas, setSoloActivas] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [nueva, setNueva] = useState(null);
  const [editando, setEditando] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");
  const [guardando, setGuardando] = useState(false);

  const query = new URLSearchParams(
    Object.entries({ rol, activo: soloActivas ? "true" : "" }).filter(([, v]) => v),
  ).toString();
  const { datos, error, cargando, recargar } = useRecurso(`/api/admin/personal${query ? `?${query}` : ""}`);

  const texto = buscar.trim().toLowerCase();
  const cuentas = (datos ?? [])
    // Sin filtro de rol solo se muestra personal, aunque el servidor ya lo hace.
    .filter((p) => rol || p.rol !== "USUARIO")
    .filter((p) => !texto || `${p.nombre} ${p.email}`.toLowerCase().includes(texto));

  const cerrarHojas = () => {
    setNueva(null);
    setEditando(null);
    setErrorHoja("");
  };

  const ejecutar = async (url, metodo, cuerpo, { cerrar = true } = {}) => {
    setGuardando(true);
    setErrorHoja("");
    try {
      const r = await pedir(url, { method: metodo, body: JSON.stringify(cuerpo) });
      recargar();
      if (cerrar) cerrarHojas();
      return r;
    } catch (err) {
      setErrorHoja(err.message);
      return null;
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Selector etiqueta="Rol" opciones={FILTROS_ROL} value={rol} onChange={(e) => setRol(e.target.value)} />
        <Campo etiqueta="Buscar" type="search" placeholder="Nombre o correo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <div className="flex items-end">
          <Casilla etiqueta="Solo cuentas activas" checked={soloActivas} onChange={(e) => setSoloActivas(e.target.checked)} />
        </div>
      </div>

      <Boton className="mb-4 w-full sm:w-auto" onClick={() => setNueva({ ...CUENTA_VACIA })}>
        <span className="flex items-center justify-center gap-2">
          <Plus size={18} /> Nueva cuenta
        </span>
      </Boton>

      <Aviso onReintentar={recargar} className="mb-4">
        {error}
      </Aviso>
      {cargando && <Cargando />}
      {!cargando && !error && cuentas.length === 0 && <Vacio>No hay cuentas con estos filtros.</Vacio>}

      <ul className="divide-y divide-filete rounded-xl border border-filete bg-white">
        {cuentas.map((p) => (
          <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${p.activo ? "" : "opacity-55"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-tinta">
                {p.nombre}
                {p.id === user.id && <span className="ml-2 rounded bg-sala px-1.5 text-[12px] text-tinta-2">Tú</span>}
              </p>
              <p className="truncate text-sm text-tinta-2">{p.email}</p>
              <p className="mt-1 flex flex-wrap gap-2 text-[13px]">
                <span className="rounded bg-tinta px-2 py-0.5 font-bold text-white">{NOMBRE_ROL[p.rol] ?? p.rol}</span>
                {!p.activo && <span className="rounded bg-brasa px-2 py-0.5 font-bold text-white">Desactivada</span>}
                {p.fechaCreacion && <span className="text-tinta-2">Desde {fechaHora(p.fechaCreacion).slice(0, 10)}</span>}
              </p>
            </div>
            <button
              aria-label={`Editar ${p.nombre}`}
              onClick={() => setEditando({ ...p, nuevoRol: p.rol, nuevaClave: "" })}
              className="flex size-12 shrink-0 items-center justify-center rounded-lg text-tinta-2 active:bg-sala"
            >
              <Pencil size={20} />
            </button>
          </li>
        ))}
      </ul>

      {nueva && (
        <Hoja titulo="Nueva cuenta" error={errorHoja} onCerrar={cerrarHojas}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              ejecutar("/api/admin/personal", "POST", nueva);
            }}
          >
            <Campo etiqueta="Nombre" required value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
            <Campo
              etiqueta="Correo"
              type="email"
              required
              autoCapitalize="none"
              autoComplete="off"
              value={nueva.email}
              onChange={(e) => setNueva({ ...nueva, email: e.target.value })}
            />
            <Campo
              etiqueta="Contraseña"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              ayuda="Mínimo 6 caracteres. Entrégala a la persona en privado."
              value={nueva.password}
              onChange={(e) => setNueva({ ...nueva, password: e.target.value })}
            />
            <Selector
              etiqueta="Rol"
              opciones={ROLES_NUEVA_CUENTA}
              value={nueva.rol}
              onChange={(e) => setNueva({ ...nueva, rol: e.target.value })}
            />
            <Boton type="submit" cargando={guardando} className="w-full">
              Crear cuenta
            </Boton>
          </form>
        </Hoja>
      )}

      {editando && (
        <EditarCuenta
          cuenta={editando}
          esPropia={editando.id === user.id}
          error={errorHoja}
          guardando={guardando}
          onCambiar={setEditando}
          onCerrar={cerrarHojas}
          ejecutar={ejecutar}
        />
      )}
    </div>
  );
}

function EditarCuenta({ cuenta, esPropia, error, guardando, onCambiar, onCerrar, ejecutar }) {
  const [hecho, setHecho] = useState("");
  const base = `/api/admin/personal/${cuenta.id}`;

  const cambiarClave = async (e) => {
    e.preventDefault();
    setHecho("");
    if (await ejecutar(`${base}/password`, "PATCH", { password: cuenta.nuevaClave }, { cerrar: false })) {
      onCambiar({ ...cuenta, nuevaClave: "" });
      setHecho("Contraseña actualizada.");
    }
  };

  const alternarActiva = () => {
    if (cuenta.activo && !window.confirm(`¿Desactivar a ${cuenta.nombre}? Se cerrará su sesión en todos los dispositivos.`)) return;
    ejecutar(`${base}/activo`, "PATCH", { activo: !cuenta.activo });
  };

  return (
    <Hoja titulo={cuenta.nombre} error={error} onCerrar={onCerrar}>
      <p className="mb-4 text-sm text-tinta-2">{cuenta.email}</p>

      {esPropia && (
        <p className="mb-4 border-l-4 border-tibio bg-tibio/10 px-3 py-2 text-sm">
          No puedes cambiar tu propio rol ni desactivarte.
        </p>
      )}

      <section className="mb-5 space-y-2">
        <Selector
          etiqueta="Rol"
          opciones={OPCIONES_ROL}
          disabled={esPropia}
          value={cuenta.nuevoRol}
          onChange={(e) => onCambiar({ ...cuenta, nuevoRol: e.target.value })}
        />
        <Boton
          variante="secundario"
          className="w-full"
          cargando={guardando}
          disabled={esPropia || cuenta.nuevoRol === cuenta.rol}
          onClick={() => ejecutar(`${base}/rol`, "PATCH", { rol: cuenta.nuevoRol })}
        >
          Cambiar rol
        </Boton>
      </section>

      <section className="mb-5">
        <Boton
          variante={cuenta.activo ? "peligro" : "primario"}
          className="w-full"
          cargando={guardando}
          disabled={esPropia}
          onClick={alternarActiva}
        >
          {cuenta.activo ? "Desactivar cuenta" : "Reactivar cuenta"}
        </Boton>
      </section>

      <form className="space-y-2 border-t border-filete pt-4" onSubmit={cambiarClave}>
        <Campo
          etiqueta="Nueva contraseña"
          type="password"
          minLength={6}
          required
          autoComplete="new-password"
          value={cuenta.nuevaClave}
          onChange={(e) => onCambiar({ ...cuenta, nuevaClave: e.target.value })}
        />
        <Boton type="submit" variante="secundario" className="w-full" cargando={guardando}>
          Cambiar contraseña
        </Boton>
        {hecho && <p className="text-sm font-semibold text-listo">{hecho}</p>}
      </form>
    </Hoja>
  );
}
