import { useCallback, useState } from "react";
import * as svc from "../../api/adminService";
import { Aviso, Cargando, Chip, Encabezado, Selector, Vacio } from "./comun";
import { codigo, fechaCorta, pesos, useCarga } from "./util";

const ESTADOS = {
  pendiente: { texto: "Pendiente", tono: "alerta" },
  aprobado: { texto: "Aprobado", tono: "ok" },
  rechazado: { texto: "Rechazado", tono: "apagado" },
};
const METODOS = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

// Pagos de los pedidos web. Aprobar un pago confirma su pedido si estaba pendiente.
export default function AdminPagos() {
  const [filtro, setFiltro] = useState({ estado: "pendiente", metodo: "" });
  const [ocupado, setOcupado] = useState(null);
  const cargar = useCallback(() => svc.listarPagos(filtro), [filtro]);
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);
  const pagos = datos ?? [];

  const cambiar = async (p, estado) => {
    if (estado === "rechazado" && !window.confirm("¿Rechazar este pago?")) return;
    setOcupado(p._id);
    try {
      await svc.cambiarEstadoPago(p._id, estado);
      await recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      <Encabezado titulo="Pagos" descripcion="Aprobar un pago confirma su pedido si todavía estaba por confirmar." />
      <div className="adm-filtros">
        <Selector
          etiqueta="Estado"
          opciones={[{ valor: "", texto: "Todos" }, ...Object.entries(ESTADOS).map(([valor, e]) => ({ valor, texto: e.texto }))]}
          value={filtro.estado}
          onChange={(v) => setFiltro({ ...filtro, estado: v })}
        />
        <Selector
          etiqueta="Método"
          opciones={[{ valor: "", texto: "Todos" }, ...Object.entries(METODOS).map(([valor, texto]) => ({ valor, texto }))]}
          value={filtro.metodo}
          onChange={(v) => setFiltro({ ...filtro, metodo: v })}
        />
      </div>

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      {cargando && !datos && <Cargando />}
      {!cargando && pagos.length === 0 && <Vacio>No hay pagos con estos filtros.</Vacio>}

      <div className="adm-tabla-wrap">
        <table className="table adm-tabla is-hoverable">
          <thead>
            <tr>
              <th>Pago</th>
              <th>Pedido</th>
              <th>Método</th>
              <th>Monto</th>
              <th>Estado</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => {
              const e = ESTADOS[p.estado] ?? { texto: p.estado, tono: "neutro" };
              return (
                <tr key={p._id}>
                  <td>
                    {codigo(p._id)}
                    <br />
                    <span className="adm-tarjeta-meta">{fechaCorta(p.createdAt)}</span>
                  </td>
                  <td>{codigo(p.pedido_id?._id ?? p.pedido_id)}</td>
                  <td>{METODOS[p.metodo] ?? p.metodo}</td>
                  <td>{pesos(p.monto)}</td>
                  <td><Chip tono={e.tono}>{e.texto}</Chip></td>
                  <td className="has-text-right" style={{ whiteSpace: "nowrap" }}>
                    {p.estado === "pendiente" && (
                      <>
                        <button type="button" className={`button is-small adm-cafe${ocupado === p._id ? " is-loading" : ""}`} disabled={ocupado === p._id} onClick={() => cambiar(p, "aprobado")}>
                          Aprobar
                        </button>{" "}
                        <button type="button" className="button is-small" disabled={ocupado === p._id} onClick={() => cambiar(p, "rechazado")}>
                          Rechazar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
