import { useCallback, useEffect, useState } from "react";
import { Aviso, Boton, Cargando, RangoFechas, Vacio } from "../../components/ui";
import { useAuth } from "../../context/sesion";
import { cantidad, ETIQUETA_PAGO, hoyISO, pesos } from "../../lib/formato";

const PESTANAS = [
  { clave: "ventas", texto: "Ventas" },
  { clave: "consumo", texto: "Consumo" },
];

export default function Reportes() {
  const { pedir } = useAuth();
  const [pestana, setPestana] = useState("ventas");
  const [rango, setRango] = useState({ desde: hoyISO(), hasta: hoyISO() });
  // El resultado guarda de qué informe es: los dos tienen forma distinta y
  // pintar uno con los datos del otro reventaba al cambiar de pestaña. También
  // descarta una respuesta que llegue tarde después de cambiar de pestaña.
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Un campo de fecha vacío no se envía: la API entiende "sin filtro" y
      // responde con el día de hoy, en vez de rechazar la cadena vacía.
      const query = new URLSearchParams(
        Object.entries(rango).filter(([, v]) => v),
      ).toString();
      const datos = await pedir(`/api/admin/reportes/${pestana}?${query}`);
      setResultado({ tipo: pestana, datos });
      setError("");
    } catch (err) {
      setError(err.message);
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }, [pedir, pestana, rango]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const datos = resultado?.tipo === pestana ? resultado.datos : null;

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        {PESTANAS.map(({ clave, texto }) => (
          <Boton
            key={clave}
            variante={pestana === clave ? "primario" : "secundario"}
            className="flex-1"
            onClick={() => setPestana(clave)}
          >
            {texto}
          </Boton>
        ))}
      </div>

      <RangoFechas rango={rango} onCambiar={setRango} />

      <Aviso onReintentar={cargar}>{error}</Aviso>

      {cargando && <Cargando />}
      {!cargando &&
        datos &&
        (pestana === "ventas" ? <Ventas datos={datos} /> : <Consumo datos={datos} />)}
    </div>
  );
}

function Tarjeta({ titulo, valor }) {
  return (
    <div className="rounded-xl border border-filete bg-white p-3">
      <p className="text-xs text-tinta-2">{titulo}</p>
      <p className="text-2xl font-extrabold tracking-[-0.02em] text-tinta">{valor}</p>
    </div>
  );
}

function Bloque({ titulo, children }) {
  return (
    <section className="mt-4">
      <h3 className="mb-2 text-lg font-extrabold tracking-[-0.02em] text-tinta">{titulo}</h3>
      <div className="overflow-hidden rounded-xl border border-filete bg-white">{children}</div>
    </section>
  );
}

function Fila({ izquierda, centro, derecha, resaltar }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-filete px-3 py-2 last:border-0">
      <span className={`min-w-0 flex-1 truncate ${resaltar ? "font-semibold text-brasa" : "text-tinta"}`}>
        {izquierda}
      </span>
      {centro && <span className="shrink-0 text-sm text-tinta-2">{centro}</span>}
      <span className="shrink-0 font-semibold text-tinta">{derecha}</span>
    </div>
  );
}

function Ventas({ datos }) {
  const { resumen, porDia, porMetodoPago, porPlato } = datos;

  if (resumen.comandas === 0) return <Vacio>No hay cuentas cobradas en este rango.</Vacio>;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Tarjeta titulo="Vendido" valor={pesos(resumen.total)} />
        <Tarjeta titulo="Cuentas" valor={resumen.comandas} />
        <Tarjeta titulo="Platos" valor={resumen.platos} />
        <Tarjeta titulo="Ticket promedio" valor={pesos(resumen.ticketPromedio)} />
      </div>

      <Bloque titulo="Por método de pago">
        {porMetodoPago.map((m) => (
          <Fila
            key={m.metodoPago}
            izquierda={ETIQUETA_PAGO[m.metodoPago] ?? m.metodoPago}
            centro={`${m.comandas} cuenta(s)`}
            derecha={pesos(m.total)}
          />
        ))}
      </Bloque>

      <Bloque titulo="Platos más vendidos">
        {porPlato.map((p) => (
          <Fila key={p.nombre} izquierda={p.nombre} centro={`×${p.cantidad}`} derecha={pesos(p.total)} />
        ))}
      </Bloque>

      {porDia.length > 1 && (
        <Bloque titulo="Por día">
          {porDia.map((d) => (
            <Fila key={d.fecha} izquierda={d.fecha} centro={`${d.comandas} cuenta(s)`} derecha={pesos(d.total)} />
          ))}
        </Bloque>
      )}
    </>
  );
}

function Consumo({ datos }) {
  if (datos.insumos.length === 0) return <Vacio>No hubo movimientos de inventario en este rango.</Vacio>;

  return (
    <Bloque titulo="Consumo por insumo">
      {datos.insumos.map((i) => (
        <div key={i.insumoId} className="border-b border-filete px-3 py-2 last:border-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 flex-1 truncate font-medium text-tinta">{i.nombre}</span>
            <span className="shrink-0 font-semibold text-tinta">
              {cantidad(i.neto)} {i.unidad}
            </span>
          </div>
          <p className="text-xs text-tinta-2">
            gastado {cantidad(i.consumido)}
            {i.devuelto > 0 && `, devuelto ${cantidad(i.devuelto)}`}
            {i.comprado > 0 && `, comprado ${cantidad(i.comprado)}`}
            {i.ajustado !== 0 && `, ajustes ${cantidad(i.ajustado)}`}
            {", "}
            <span className={i.stockActual < 0 ? "font-semibold text-brasa" : i.bajoMinimo ? "font-semibold text-rio" : ""}>
              quedan {cantidad(i.stockActual)} {i.unidad}
            </span>
          </p>
        </div>
      ))}
    </Bloque>
  );
}
