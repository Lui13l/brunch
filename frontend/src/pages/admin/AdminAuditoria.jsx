import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import * as svc from "../../services/adminService";
import { Aviso, Cargando, Encabezado, RangoFechas, Selector, Vacio } from "./comun";
import { hoy, useCarga } from "./util";

const SERVICIOS = {
  menu: "Menú",
  pedidos: "Pedidos web",
  reservas: "Reservas",
  personal: "Personal",
  chatbot: "Chatbot",
  comandas: "Comandas",
  caja: "Caja",
  inventario: "Inventario",
};
const ROL = { ADMIN: "Administración", MESERO: "Mesero", COCINA: "Cocina", USUARIO: "Cliente" };
// "2026-11-06" -> "Viernes 6 de noviembre"
const diaLegible = (dia) => {
  const d = new Date(`${dia}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dia;
  const t = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const LIMITES = [100, 200, 500].map((n) => ({ valor: String(n), texto: `${n} más recientes` }));

// Quién hizo qué, tanto en la web como en la app de comandas.
export default function AdminAuditoria() {
  const [filtros, setFiltros] = useState({ servicio: "", usuarioId: "", limite: "100" });
  const [rango, setRango] = useState({ desde: hoy(), hasta: hoy() });
  const cargar = useCallback(
    () => Promise.all([svc.listarAuditoria({ ...filtros, ...rango }), svc.listarUsuarios()]),
    [filtros, rango],
  );
  const { datos, error, cargando, recargar } = useCarga(cargar);
  const [registros, usuarios] = datos ?? [[], []];

  const personal = usuarios.filter((u) => u.rol_id !== "cliente");
  const dias = [];
  for (const r of registros) {
    const dia = r.fecha?.slice(0, 10) ?? "";
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, filas: [] });
    dias.at(-1).filas.push(r);
  }

  return (
    <>
      <Encabezado titulo="Auditoría" descripcion="Historial de acciones del personal en la web y en la app de comandas.">
        <button type="button" className="button" onClick={recargar} disabled={cargando}>
          <RefreshCw size={16} />
          <span>&nbsp;Actualizar</span>
        </button>
      </Encabezado>

      <div className="adm-filtros">
        <Selector
          etiqueta="Servicio"
          opciones={[{ valor: "", texto: "Todos" }, ...Object.entries(SERVICIOS).map(([valor, texto]) => ({ valor, texto }))]}
          value={filtros.servicio}
          onChange={(v) => setFiltros({ ...filtros, servicio: v })}
        />
        <Selector
          etiqueta="Usuario"
          opciones={[{ valor: "", texto: "Todos" }, ...personal.map((u) => ({ valor: u._id, texto: u.nombre }))]}
          value={filtros.usuarioId}
          onChange={(v) => setFiltros({ ...filtros, usuarioId: v })}
        />
        <Selector etiqueta="Mostrar" opciones={LIMITES} value={filtros.limite} onChange={(v) => setFiltros({ ...filtros, limite: v })} />
        <RangoFechas rango={rango} onCambiar={setRango} />
      </div>

      <Aviso>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && registros.length === 0 && <Vacio>No hay acciones registradas con estos filtros.</Vacio>}

      {dias.map(({ dia, filas }) => (
        <section key={dia} style={{ marginBottom: "1.25rem" }}>
          <h3 className="adm-dia">{diaLegible(dia)}</h3>
          <div className="adm-tabla-wrap">
            <table className="table adm-tabla is-narrow is-fullwidth">
              <tbody>
                {filas.map((r) => (
                  <tr key={r.id}>
                    <td className="adm-hora">{r.fecha?.slice(11, 16)}</td>
                    <td>
                      <span className="adm-accion">{r.detalle}</span>
                      <br />
                      <span className="adm-tarjeta-meta">
                        {r.usuario ? `${r.usuario.nombre}, ${(ROL[r.usuario.rol] ?? r.usuario.rol).toLowerCase()}` : "Sistema"}
                      </span>
                    </td>
                    <td className="has-text-right">
                      <span className="adm-etiqueta">{SERVICIOS[r.servicio] ?? r.servicio}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {registros.length > 0 && registros.length === Number(filtros.limite) && (
        <p className="adm-vacio">Se muestran los {filtros.limite} más recientes; acota el rango para ver más.</p>
      )}
    </>
  );
}
