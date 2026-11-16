import { ArrowDownLeft, ArrowUpRight, Ban, Lock, Unlock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Aviso, Boton, Campo, Cargando, Hoja, Selector, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { useWebSocket } from "../../hooks/useWebSocket";
import { ETIQUETA_PAGO, pesos } from "../../lib/formato";

const TOPICS = ["/topic/admin/caja"];
const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"];

const CONTEO_VACIO = { EFECTIVO: "", TARJETA: "", TRANSFERENCIA: "" };

export default function Caja() {
  const { pedir } = useAuth();
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const [abriendo, setAbriendo] = useState(null);
  const [movimiento, setMovimiento] = useState(null);
  const [cerrando, setCerrando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setEstado(await pedir("/api/admin/caja"));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [pedir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El servidor empuja el cuadre completo cada vez que se cobra una mesa o se
  // registra un movimiento: no hace falta volver a pedirlo.
  useWebSocket("/ws", TOPICS, (_topic, mensaje) => {
    if (mensaje?.abierta === false) {
      // Otra persona cerró la caja: las hojas abiertas dependen del cuadre y ya no aplican.
      setCerrando(null);
      setMovimiento(null);
      setEstado({ abierta: false, arqueo: null, cuadre: null });
    }
    else if (mensaje?.arqueo) setEstado(mensaje);
  });

  const enviar = async (url, cuerpo, metodo = "POST") => {
    setOcupado(true);
    setError("");
    try {
      setEstado(await pedir(url, { method: metodo, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) }));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setOcupado(false);
    }
  };

  if (cargando) return <Cargando />;

  const { abierta, arqueo, cuadre } = estado ?? {};

  return (
    <div className="p-4">
      <Aviso onReintentar={cargar}>{error}</Aviso>

      {!abierta ? (
        <SinCaja onAbrir={() => setAbriendo({ baseInicial: "", notas: "" })} />
      ) : (
        <>
          <Resumen cuadre={cuadre} arqueo={arqueo} />

          <div className="mt-4 flex gap-2">
            <Boton
              variante="secundario"
              className="flex flex-1 items-center justify-center gap-2"
              onClick={() => setMovimiento({ tipo: "INGRESO", metodo: "EFECTIVO", concepto: "", monto: "" })}
            >
              <ArrowDownLeft size={18} /> Entrada
            </Boton>
            <Boton
              variante="secundario"
              className="flex flex-1 items-center justify-center gap-2"
              onClick={() => setMovimiento({ tipo: "EGRESO", metodo: "EFECTIVO", concepto: "", monto: "" })}
            >
              <ArrowUpRight size={18} /> Salida
            </Boton>
            <Boton
              variante="marca"
              className="flex flex-1 items-center justify-center gap-2"
              onClick={() => setCerrando({ conteo: { ...CONTEO_VACIO }, notas: "" })}
            >
              <Lock size={18} /> Cerrar caja
            </Boton>
          </div>

          <Movimientos
            movimientos={arqueo.movimientos}
            onAnular={(id) => enviar(`/api/admin/caja/movimientos/${id}`, null, "DELETE")}
            ocupado={ocupado}
          />
        </>
      )}

      {abriendo && (
        <Hoja titulo="Abrir caja" error={error} onCerrar={() => setAbriendo(null)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await enviar("/api/admin/caja/abrir", {
                baseInicial: Number(abriendo.baseInicial || 0),
                notas: abriendo.notas || null,
              });
              if (ok) setAbriendo(null);
            }}
          >
            <Campo
              etiqueta="Base inicial"
              type="number"
              required
              min="0"
              step="1"
              autoFocus
              value={abriendo.baseInicial}
              onChange={(e) => setAbriendo({ ...abriendo, baseInicial: e.target.value })}
              ayuda="El dinero con el que empieza el cajón, antes de vender nada."
            />
            <Campo
              etiqueta="Notas"
              value={abriendo.notas}
              onChange={(e) => setAbriendo({ ...abriendo, notas: e.target.value })}
            />
            <Boton type="submit" cargando={ocupado} className="w-full">
              Abrir caja
            </Boton>
          </form>
        </Hoja>
      )}

      {movimiento && (
        <Hoja
          titulo={movimiento.tipo === "INGRESO" ? "Entrada de dinero" : "Salida de dinero"}
          error={error}
          onCerrar={() => setMovimiento(null)}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await enviar("/api/admin/caja/movimientos", {
                tipo: movimiento.tipo,
                concepto: movimiento.concepto,
                monto: Number(movimiento.monto),
                metodo: movimiento.metodo,
              });
              if (ok) setMovimiento(null);
            }}
          >
            {/* Las ventas ya entran solas: esto es para lo demás. Sin esta
                aclaración se termina registrando dos veces una venta. */}
            <p className="border-l-4 border-tibio bg-tibio/10 px-3 py-2 text-sm text-tinta">
              Las cuentas de mesa y los pedidos web <strong>ya se suman solos</strong>, también los pagados con tarjeta
              o transferencia. Registra aquí solo dinero que no viene de una venta:{" "}
              {movimiento.tipo === "INGRESO"
                ? "un anticipo de un evento, cambio que se trae al cajón, un préstamo."
                : "el pago a un proveedor, una devolución a un cliente, un retiro."}
            </p>
            <Selector
              etiqueta="Tipo"
              value={movimiento.tipo}
              onChange={(e) => setMovimiento({ ...movimiento, tipo: e.target.value })}
              opciones={[
                { valor: "INGRESO", texto: "Entrada de dinero" },
                { valor: "EGRESO", texto: "Salida de dinero" },
              ]}
            />
            <fieldset>
              <legend className="mb-1 block text-sm font-semibold text-tinta-2">¿Por dónde?</legend>
              <div className="grid grid-cols-3 gap-2">
                {METODOS.map((metodo) => (
                  <button
                    key={metodo}
                    type="button"
                    aria-pressed={movimiento.metodo === metodo}
                    onClick={() => setMovimiento({ ...movimiento, metodo })}
                    className={`min-h-12 rounded-lg px-2 text-[15px] font-bold transition ${
                      movimiento.metodo === metodo
                        ? "bg-tinta text-white"
                        : "border border-filete bg-mantel text-tinta active:bg-sala"
                    }`}
                  >
                    {ETIQUETA_PAGO[metodo]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[13px] text-tinta-2">
                {movimiento.metodo === "EFECTIVO"
                  ? "Cambia lo que debería haber en el cajón."
                  : `No toca el cajón: ${movimiento.tipo === "INGRESO" ? "suma a" : "resta de"} lo que debe cuadrar ${
                      movimiento.metodo === "TARJETA" ? "contra el datáfono" : "contra el banco"
                    }. Sirve, por ejemplo, para ${
                      movimiento.tipo === "INGRESO"
                        ? "un anticipo que el cliente pagó así"
                        : "una devolución que se hizo por ese medio"
                    }.`}
              </p>
            </fieldset>
            <Campo
              etiqueta="Concepto"
              required
              maxLength={255}
              autoFocus
              value={movimiento.concepto}
              onChange={(e) => setMovimiento({ ...movimiento, concepto: e.target.value })}
              ayuda="Obligatorio: un movimiento sin explicar es el que después nadie justifica."
            />
            <Campo
              etiqueta="Monto"
              type="number"
              required
              min="1"
              step="1"
              value={movimiento.monto}
              onChange={(e) => setMovimiento({ ...movimiento, monto: e.target.value })}
            />
            <Boton type="submit" cargando={ocupado} className="w-full">
              Registrar
            </Boton>
          </form>
        </Hoja>
      )}

      {cerrando && (
        <Hoja titulo="Cerrar caja" error={error} onCerrar={() => setCerrando(null)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await enviar("/api/admin/caja/cerrar", {
                contadoEfectivo: Number(cerrando.conteo.EFECTIVO || 0),
                contadoTarjeta: Number(cerrando.conteo.TARJETA || 0),
                contadoTransferencia: Number(cerrando.conteo.TRANSFERENCIA || 0),
                notas: cerrando.notas || null,
              });
              if (ok) setCerrando(null);
            }}
          >
            <p className="text-sm text-tinta-2">
              Cuenta el dinero y escribe lo que hay <strong>de verdad</strong>. La diferencia se calcula sola.
            </p>

            {METODOS.map((metodo) => {
              const esperado = cuadre?.esperado?.[metodo] ?? 0;
              const escrito = cerrando.conteo[metodo];
              const diferencia = escrito === "" ? null : Number(escrito) - esperado;

              return (
                <div key={metodo}>
                  <Campo
                    etiqueta={`${ETIQUETA_PAGO[metodo]} contado`}
                    type="number"
                    required
                    min="0"
                    step="1"
                    autoFocus={metodo === "EFECTIVO"}
                    value={escrito}
                    onChange={(e) =>
                      setCerrando({ ...cerrando, conteo: { ...cerrando.conteo, [metodo]: e.target.value } })
                    }
                    ayuda={`Esperado: ${pesos(esperado)}`}
                  />
                  {diferencia !== null && diferencia !== 0 && (
                    <p className={`mt-1 text-sm font-semibold ${diferencia < 0 ? "text-brasa" : "text-rio"}`}>
                      {diferencia < 0 ? "Faltan " : "Sobran "}
                      {pesos(Math.abs(diferencia))}
                    </p>
                  )}
                </div>
              );
            })}

            <Campo
              etiqueta="Notas del cierre"
              value={cerrando.notas}
              onChange={(e) => setCerrando({ ...cerrando, notas: e.target.value })}
              ayuda="Si hay descuadre, explica aquí a qué se debió."
            />
            <Boton type="submit" variante="marca" cargando={ocupado} className="w-full">
              Cerrar caja
            </Boton>
          </form>
        </Hoja>
      )}
    </div>
  );
}

function SinCaja({ onAbrir }) {
  return (
    <div className="rounded-2xl border border-filete bg-white p-8 text-center">
      <Unlock className="mx-auto mb-3 text-filete" size={40} />
      <p className="mb-1 text-lg font-bold text-tinta">La caja está cerrada</p>
      <p className="mb-5 text-sm text-tinta-2">
        Ábrela con el dinero que haya en el cajón para empezar a cuadrar el día.
      </p>
      <Boton onClick={onAbrir}>Abrir caja</Boton>
    </div>
  );
}

function Resumen({ cuadre, arqueo }) {
  const sinMetodo = cuadre.ventas.SIN_REGISTRAR;
  // Entradas y salidas manuales de cada método (el servidor las separa).
  const de = (metodo) => cuadre.movimientos?.[metodo] ?? { ingresos: 0, egresos: 0 };
  const efectivo = de("EFECTIVO");
  // Lo que entró por pedidos web con pago aprobado (el servidor lo suma solo).
  const web = (metodo) => cuadre.ventasWeb?.[metodo] ?? 0;
  const pedidosWeb = cuadre.pedidosWeb ?? 0;
  const desglose = (metodo) => {
    const { ingresos, egresos } = de(metodo);
    return (
      `Mesas ${pesos(cuadre.ventas[metodo])}` +
      (web(metodo) > 0 ? ` + pedidos web ${pesos(web(metodo))}` : "") +
      (ingresos > 0 ? ` + entradas ${pesos(ingresos)}` : "") +
      (egresos > 0 ? ` − salidas ${pesos(egresos)}` : "")
    );
  };

  return (
    <>
      {/* La cifra esperada es lo único grande de la pantalla: es la pregunta
          que el cajero se hace cada vez que mira aquí. */}
      <div className="rounded-2xl bg-tinta p-5 text-white">
        <p className="text-base font-semibold text-white/70">Debería haber en el cajón</p>
        <p className="mt-1 text-5xl leading-none font-extrabold tracking-[-0.035em]">
          {pesos(cuadre.esperado.EFECTIVO)}
        </p>
        <p className="mt-3 text-[15px] text-white/70">
          Base {pesos(cuadre.baseInicial)} + mesas en efectivo {pesos(cuadre.ventas.EFECTIVO)}
          {web("EFECTIVO") > 0 && ` + pedidos web ${pesos(web("EFECTIVO"))}`}
          {efectivo.ingresos > 0 && ` + entradas ${pesos(efectivo.ingresos)}`}
          {efectivo.egresos > 0 && ` − salidas ${pesos(efectivo.egresos)}`}
        </p>
        <p className="mt-2 text-[13px] text-white/50">
          Abierta desde {arqueo.fechaApertura?.replace("T", " ").slice(0, 16)}, {cuadre.comandas}{" "}
          {cuadre.comandas === 1 ? "cuenta cobrada" : "cuentas cobradas"}
          {pedidosWeb > 0 && ` y ${pedidosWeb} ${pedidosWeb === 1 ? "pedido web pagado" : "pedidos web pagados"}`}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tarjeta
          titulo="Tarjeta"
          valor={cuadre.esperado.TARJETA}
          nota="Cuadra contra el datáfono"
          detalle={desglose("TARJETA")}
        />
        <Tarjeta
          titulo="Transferencias"
          valor={cuadre.esperado.TRANSFERENCIA}
          nota="Cuadra contra el banco"
          detalle={desglose("TRANSFERENCIA")}
        />
      </div>

      {/* Qué se suma solo: evita registrar a mano una venta que ya está contada. */}
      <details className="mt-3 rounded-xl border border-filete bg-white px-3 py-2 text-sm text-tinta-2">
        <summary className="min-h-8 font-bold text-tinta">¿Qué se suma solo y qué se registra a mano?</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-tinta">Mesas:</strong> cada cuenta entra al cobrarla, en el método con que se pagó.
            Si la cuenta se dividió, cada parte entra en su método: una en efectivo, otra en tarjeta y otra en
            transferencia quedan repartidas así, sin hacer nada más.
          </li>
          <li>
            <strong className="text-tinta">Pedidos web:</strong> entran cuando se aprueba su pago (efectivo, tarjeta o
            transferencia). Si el pedido se cancela, dejan de contar.
          </li>
          <li>
            <strong className="text-tinta">A mano (Entrada y Salida):</strong> solo el dinero que no viene de una
            cuenta ni de un pedido, como un anticipo, el pago a un proveedor o una devolución.
          </li>
        </ul>
      </details>

      {sinMetodo > 0 && (
        <div className="mt-3 rounded-xl border border-brasa/40 bg-brasa/8 p-3 text-sm text-brasa">
          <strong>{pesos(sinMetodo)}</strong> en cuentas cerradas sin método de pago. No entran en ningún esperado:
          revísalas antes de cerrar.
        </div>
      )}
    </>
  );
}

function Tarjeta({ titulo, valor, nota, detalle }) {
  return (
    <div className="rounded-xl bg-mantel p-3">
      <p className="text-sm font-semibold text-tinta-2">{titulo}</p>
      <p className="text-2xl font-extrabold tracking-[-0.02em] text-tinta">{pesos(valor)}</p>
      {detalle && <p className="mt-0.5 text-[13px] font-semibold text-tinta">{detalle}</p>}
      <p className="mt-0.5 text-[13px] text-tinta-2">{nota}</p>
    </div>
  );
}

function Movimientos({ movimientos, onAnular, ocupado }) {
  if (!movimientos || movimientos.length === 0) {
    return (
      <section className="mt-5">
        <h3 className="mb-2 text-lg font-extrabold tracking-[-0.02em] text-tinta">Movimientos</h3>
        <Vacio>Sin entradas ni salidas de dinero.</Vacio>
      </section>
    );
  }

  return (
    <section className="mt-5">
      <h3 className="mb-2 text-lg font-extrabold tracking-[-0.02em] text-tinta">Movimientos</h3>
      <ul className="overflow-hidden rounded-xl border border-filete bg-white">
        {movimientos.map((m) => (
          <li
            key={m.id}
            className={`flex items-center gap-3 border-b border-filete px-3 py-2 last:border-0 ${
              m.anulado ? "opacity-50" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className={`truncate font-medium text-tinta ${m.anulado ? "line-through" : ""}`}>{m.concepto}</p>
              <p className="text-xs text-tinta-2">
                {ETIQUETA_PAGO[m.metodo] ?? "Efectivo"}, {m.fecha?.replace("T", " ").slice(0, 16)}
                {m.anulado && ", anulado"}
              </p>
            </div>
            <span className={`shrink-0 font-semibold ${m.tipo === "EGRESO" ? "text-brasa" : "text-listo"}`}>
              {m.tipo === "EGRESO" ? "−" : "+"}
              {pesos(m.monto)}
            </span>
            {!m.anulado && (
              <button
                onClick={() => onAnular(m.id)}
                disabled={ocupado}
                title="Anular"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-tinta-2 active:bg-sala disabled:opacity-40"
              >
                <Ban size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-tinta-2">
        Los movimientos no se borran: se anulan, para que el arqueo siempre pueda explicarse.
      </p>
    </section>
  );
}
