import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Aviso, Boton, Cargando, RangoFechas, Selector, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useRecurso } from "../../hooks/useRecurso";
import { ETIQUETA_SERVICIO, NOMBRE_ROL, hoyISO } from "../../lib/formato";

const SERVICIOS = [{ valor: "", texto: "Todos" }, ...Object.entries(ETIQUETA_SERVICIO).map(([valor, texto]) => ({ valor, texto }))];
const LIMITES = [100, 200, 500].map((n) => ({ valor: String(n), texto: `${n} más recientes` }));

// Quién hizo qué: caja, inventario, carta, comandas, pedidos web y personal.
export default function Auditoria() {
  const { pedir } = useAuth();
  const [filtros, setFiltros] = useState({ servicio: "", usuarioId: "", limite: "100" });
  const [rango, setRango] = useState({ desde: hoyISO(), hasta: hoyISO() });
  const [registros, setRegistros] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const { datos: personal } = useRecurso("/api/admin/personal");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const query = new URLSearchParams(Object.entries({ ...filtros, ...rango }).filter(([, v]) => v)).toString();
      setRegistros(await pedir(`/api/admin/auditoria?${query}`));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [pedir, filtros, rango]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const usuarios = [{ valor: "", texto: "Todos" }, ...(personal ?? []).map((p) => ({ valor: p.id, texto: p.nombre }))];

  // Agrupados por día, del más reciente al más antiguo.
  const dias = [];
  for (const r of registros) {
    const dia = r.fecha?.slice(0, 10) ?? "";
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, filas: [] });
    dias.at(-1).filas.push(r);
  }

  return (
    <div className="p-4">
      <div className="mb-2 grid gap-2 sm:grid-cols-3">
        <Selector
          etiqueta="Servicio"
          opciones={SERVICIOS}
          value={filtros.servicio}
          onChange={(e) => setFiltros({ ...filtros, servicio: e.target.value })}
        />
        <Selector
          etiqueta="Usuario"
          opciones={usuarios}
          value={filtros.usuarioId}
          onChange={(e) => setFiltros({ ...filtros, usuarioId: e.target.value })}
        />
        <Selector
          etiqueta="Mostrar"
          opciones={LIMITES}
          value={filtros.limite}
          onChange={(e) => setFiltros({ ...filtros, limite: e.target.value })}
        />
      </div>
      <RangoFechas rango={rango} onCambiar={setRango} />

      <div className="mb-3 flex justify-end">
        <Boton variante="secundario" onClick={cargar} cargando={cargando}>
          <span className="flex items-center gap-2">
            <RefreshCw size={16} /> Actualizar
          </span>
        </Boton>
      </div>

      <Aviso onReintentar={cargar} className="mb-4">
        {error}
      </Aviso>
      {cargando && registros.length === 0 && <Cargando />}
      {!cargando && !error && registros.length === 0 && <Vacio>No hay acciones registradas con estos filtros.</Vacio>}

      {dias.map(({ dia, filas }) => (
        <section key={dia} className="mb-5">
          <h3 className="mb-2 text-sm font-extrabold tracking-wide text-tinta-2 uppercase">{dia}</h3>
          <ul className="divide-y divide-filete rounded-xl border border-filete bg-white">
            {filas.map((r) => (
              <li key={r.id} className="flex gap-3 px-4 py-3">
                <span className="w-12 shrink-0 font-bold text-tinta-2 tabular-nums">{r.fecha?.slice(11, 16)}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-tinta">{r.accion}</span>
                    <span className="rounded bg-espera px-2 py-0.5 text-[12px] font-bold text-tinta-2">
                      {ETIQUETA_SERVICIO[r.servicio] ?? r.servicio}
                    </span>
                  </p>
                  <p className="text-[15px] break-words text-tinta">{r.detalle}</p>
                  <p className="text-[13px] text-tinta-2">
                    {r.usuario ? `${r.usuario.nombre} · ${NOMBRE_ROL[r.usuario.rol] ?? r.usuario.rol}` : "Sistema"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {registros.length > 0 && registros.length === Number(filtros.limite) && (
        <p className="text-center text-sm text-tinta-2">
          Se muestran los {filtros.limite} más recientes; acota el rango para ver más.
        </p>
      )}
    </div>
  );
}
