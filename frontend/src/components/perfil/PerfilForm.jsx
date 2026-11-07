export default function PerfilForm({
  user,
  form,
  onChange,
  onSubmit,
  error,
  mensaje,
  guardando,
  cerrandoSesion,
}) {
  return (
    <section className="perfil-card" aria-labelledby="perfil-title">
      <span className="perfil-eyebrow">Tu cuenta</span>
      <h1 id="perfil-title" className="perfil-title">Mi perfil</h1>
      <p className="perfil-subtitle">Administra la información de tu cuenta.</p>
      {error && <p className="perfil-error" role="alert">{error}</p>}
      {mensaje && <p className="perfil-success" role="status">{mensaje}</p>}

      <form className="perfil-form" onSubmit={onSubmit}>
        <div className="perfil-field">
          <label htmlFor="perfil-nombre">Nombre de usuario</label>
          <input
            id="perfil-nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            value={form.nombre}
            onChange={onChange}
            required
          />
        </div>
        <div className="perfil-field">
          <label htmlFor="perfil-correo">Correo electrónico</label>
          <input
            id="perfil-correo"
            type="email"
            autoComplete="email"
            value={user?.correo || ""}
            readOnly
          />
        </div>
        <div className="perfil-field">
          <label htmlFor="perfil-direccion">Dirección</label>
          <input
            id="perfil-direccion"
            name="direccion"
            type="text"
            autoComplete="street-address"
            placeholder="Tu dirección"
            value={form.direccion}
            onChange={onChange}
          />
        </div>
        <div className="perfil-field">
          <label htmlFor="perfil-celular">Teléfono</label>
          <input
            id="perfil-celular"
            name="celular"
            type="tel"
            autoComplete="tel"
            placeholder="Tu número de teléfono"
            value={form.celular}
            onChange={onChange}
          />
        </div>
        <div className="perfil-field">
          <label htmlFor="perfil-password">Nueva contraseña</label>
          <input
            id="perfil-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Deja este campo vacío para mantenerla"
            value={form.password}
            onChange={onChange}
          />
          <span className="perfil-help">Tu contraseña actual nunca se muestra.</span>
        </div>
        <div className="perfil-field">
          <label htmlFor="perfil-confirmar-password">Confirmar nueva contraseña</label>
          <input
            id="perfil-confirmar-password"
            name="confirmarPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repite la nueva contraseña"
            value={form.confirmarPassword}
            onChange={onChange}
          />
        </div>
        <button type="submit" className="perfil-save" disabled={guardando || cerrandoSesion}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </section>
  );
}
