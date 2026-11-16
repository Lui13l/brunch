import { useCallback, useState } from "react";
import { FileText, Send } from "lucide-react";
import * as svc from "../../services/adminService";
import { Aviso, Cargando, Chip, Encabezado, Selector, Vacio } from "./comun";
import { codigo, fechaCorta, pesos, useCarga } from "./util";

const ENVIOS = {
  enviada: { texto: "Enviada", tono: "ok" },
  sin_enviar: { texto: "Sin enviar", tono: "proceso" },
  error: { texto: "No se pudo enviar", tono: "alerta" },
};
const METODOS = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

// Comprobantes en PDF de los pedidos web. Los pagados por transferencia salen
// solos al entregar el pedido; los demás se generan aquí. No son facturas
// electrónicas ante la DIAN.
export default function AdminFacturas() {
  const [estado, setEstado] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState("");
  const cargar = useCallback(
    () => Promise.all([svc.listarFacturas({ estado }), svc.pedidosSinFactura()]),
    [estado],
  );
  const { datos, error, setError, cargando, recargar } = useCarga(cargar);
  const [facturas, pendientes] = datos ?? [[], []];

  // Qué pasó con el correo, dicho para quien atiende el panel.
  const contarEnvio = (f) => {
    if (f.envio.estado === "enviada") return `Comprobante ${f.numero} enviado a ${f.cliente.correo}.`;
    return `Comprobante ${f.numero} listo, pero no se envió: ${f.envio.detalle ?? "revisa el correo del cliente"}.`;
  };

  const accion = async (clave, ejecutar) => {
    setOcupado(clave);
    setAviso("");
    setError("");
    try {
      setAviso(contarEnvio(await ejecutar()));
      await recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  };

  const verPdf = async (f) => {
    // La pestaña se abre dentro del clic: si se abriera al terminar la
    // descarga, el navegador la bloquearía como ventana emergente.
    const pestana = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(await svc.descargarFactura(f.id));
      if (pestana) {
        pestana.location.href = url;
      } else {
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `comprobante-${f.numero}.pdf`;
        enlace.click();
      }
      // Se libera después: la pestaña necesita un momento para cargarlo.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      pestana?.close();
      setError(err.message);
    }
  };

  return (
    <>
      <Encabezado
        titulo="Facturas"
        descripcion="Comprobantes en PDF de los pedidos web. Los pagados por transferencia se envían solos al entregar el pedido; los demás se generan aquí."
      />

      <Aviso onCerrar={() => setError("")}>{error}</Aviso>
      <Aviso tipo="ok" onCerrar={() => setAviso("")}>{aviso}</Aviso>

      {pendientes.length > 0 && (
        <section className="adm-bloque" aria-label="Pedidos entregados sin comprobante">
          <h3 className="adm-subtitulo">Pedidos entregados sin comprobante</h3>
          <ul className="adm-lista">
            {pendientes.map((p) => (
              <li key={p.pedidoId} className="adm-tarjeta">
                <div className="adm-tarjeta-cabeza">
                  <span className="adm-tarjeta-titulo">Pedido {codigo(p.pedidoId)}</span>
                  <span>{pesos(p.total)}</span>
                </div>
                <p className="adm-tarjeta-meta">
                  {p.cliente.nombre || "Cliente"} · {fechaCorta(p.fecha)}
                </p>
                <div className="adm-tarjeta-acciones">
                  <button
                    type="button"
                    className={`button is-small adm-cafe${ocupado === p.pedidoId ? " is-loading" : ""}`}
                    disabled={Boolean(ocupado)}
                    onClick={() => accion(p.pedidoId, () => svc.generarFactura(p.pedidoId))}
                  >
                    Generar comprobante
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="adm-filtros">
        <Selector
          etiqueta="Envío"
          opciones={[{ valor: "", texto: "Todos" }, ...Object.entries(ENVIOS).map(([valor, e]) => ({ valor, texto: e.texto }))]}
          value={estado}
          onChange={setEstado}
        />
      </div>

      {cargando && !datos && <Cargando />}
      {!cargando && facturas.length === 0 && (
        <Vacio>{estado ? "No hay comprobantes con este filtro." : "Todavía no se ha emitido ningún comprobante."}</Vacio>
      )}

      {facturas.length > 0 && (
        <div className="adm-tabla-wrap">
          <table className="table adm-tabla is-hoverable">
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Envío</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => {
                const e = ENVIOS[f.envio.estado] ?? { texto: f.envio.estado, tono: "neutro" };
                return (
                  <tr key={f.id}>
                    <td>
                      {f.numero}
                      <br />
                      <span className="adm-tarjeta-meta">{fechaCorta(f.fechaEmision)}</span>
                    </td>
                    <td>
                      {codigo(f.pedidoId)}
                      <br />
                      <span className="adm-tarjeta-meta">{METODOS[f.metodoPago] ?? "Sin pago registrado"}</span>
                    </td>
                    <td>
                      {f.cliente.nombre || "Cliente"}
                      <br />
                      <span className="adm-tarjeta-meta">{f.cliente.correo}</span>
                    </td>
                    <td>{pesos(f.total)}</td>
                    <td>
                      <Chip tono={e.tono}>{e.texto}</Chip>
                      {f.envio.estado !== "enviada" && f.envio.detalle && (
                        <>
                          <br />
                          <span className="adm-tarjeta-meta">{f.envio.detalle}</span>
                        </>
                      )}
                    </td>
                    <td className="has-text-right" style={{ whiteSpace: "nowrap" }}>
                      <button type="button" className="button is-small" onClick={() => verPdf(f)}>
                        <FileText size={14} aria-hidden="true" />
                        <span>&nbsp;Ver PDF</span>
                      </button>{" "}
                      <button
                        type="button"
                        className={`button is-small${ocupado === f.id ? " is-loading" : ""}`}
                        disabled={Boolean(ocupado)}
                        onClick={() => accion(f.id, () => svc.reenviarFactura(f.id))}
                      >
                        <Send size={14} aria-hidden="true" />
                        <span>&nbsp;{f.envio.estado === "enviada" ? "Reenviar" : "Enviar"}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
