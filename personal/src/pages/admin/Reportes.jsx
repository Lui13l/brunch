import { useCallback, useEffect, useState } from "react";
import { Aviso, Boton, Cargando, RangoFechas, Vacio } from "../../components/ui";
import { BarrasHorizontales, Linea } from "../../components/Barras";
import { useAuth } from "../../context/sesion";
import { cantidad, diaCorto, ETIQUETA_PAGO, hoyISO, pesos, pesosCompactos } from "../../lib/formato";

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
      // responde con el día de hoy, en vez de rechazar la cadena vacía. Con
      // los dos vacíos (atajo "Todo") se pide el informe de todo el tiempo.
      const fechas = Object.entries(rango).filter(([, v]) => v);
      const query = new URLSearchParams(fechas.length > 0 ? fechas : [["todo", "true"]]).toString();
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
      <div className="rounded-xl border border-filete bg-white">{children}</div>
    </section>
  );
}

// La gráfica muestra la forma; la tabla, cada número. Va plegada para no
// repetir lo mismo dos veces en pantalla.
function Tabla({ children }) {
  return (
    <details className="border-t border-filete">
      <summary className="flex min-h-12 cursor-pointer items-center px-3 text-[15px] font-semibold text-tinta-2">
        Ver en tabla
      </summary>
      <div className="border-t border-filete">{children}</div>
    </details>
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

const cuentas = (n) => `${n} ${n === 1 ? "cuenta" : "cuentas"}`;
const MAS_VENDIDOS = 10;

// Con muchos días las columnas no caben ni se leen: se juntan por mes.
const DIAS_POR_COLUMNAS = 45;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;

const agruparPorMes = (porDia) => {
  const meses = new Map();
  for (const dia of porDia) {
    const clave = dia.fecha.slice(0, 7);
    const mes = meses.get(clave) ?? { fecha: clave, comandas: 0, total: 0 };
    mes.comandas += dia.comandas;
    mes.total += dia.total;
    meses.set(clave, mes);
  }
  return [...meses.values()];
};

function Ventas({ datos }) {
  const { resumen, porDia, porMetodoPago, porPlato } = datos;

  if (resumen.comandas === 0) return <Vacio>No hay cuentas cobradas en este rango.</Vacio>;

  const platos = [...porPlato].sort((a, b) => b.cantidad - a.cantidad);
  const porMes = porDia.length > DIAS_POR_COLUMNAS;
  const serie = porMes ? agruparPorMes(porDia) : porDia;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Tarjeta titulo="Vendido" valor={pesos(resumen.total)} />
        <Tarjeta titulo="Cuentas" valor={resumen.comandas} />
        <Tarjeta titulo="Platos" valor={resumen.platos} />
        <Tarjeta titulo="Ticket promedio" valor={pesos(resumen.ticketPromedio)} />
      </div>

      {serie.length > 1 && (
        <Bloque titulo={porMes ? "Ventas por mes" : "Ventas por día"}>
          <div className="p-3 pt-8">
            <Linea
              titulo={porMes ? "Ventas por mes" : "Ventas por día"}
              cada={porMes ? "mes" : "día"}
              formatoEje={pesosCompactos}
              puntos={serie.map((d) => ({
                clave: d.fecha,
                etiqueta: porMes ? mesCorto(d.fecha) : diaCorto(d.fecha),
                etiquetaCorta: porMes ? mesCorto(d.fecha) : serie.length > 10 ? d.fecha.slice(8) : diaCorto(d.fecha),
                valor: d.total,
                texto: pesos(d.total),
                extra: cuentas(d.comandas),
              }))}
            />
          </div>
          <Tabla>
            {porDia.map((d) => (
              <Fila key={d.fecha} izquierda={d.fecha} centro={cuentas(d.comandas)} derecha={pesos(d.total)} />
            ))}
          </Tabla>
        </Bloque>
      )}

      <Bloque titulo="Ventas por método de pago">
        <div className="p-2">
          <BarrasHorizontales
            titulo="Ventas por método de pago"
            total={resumen.total}
            filas={porMetodoPago.map((m) => ({
              clave: m.metodoPago,
              etiqueta: ETIQUETA_PAGO[m.metodoPago] ?? m.metodoPago,
              valor: m.total,
              texto: pesos(m.total),
              extra: cuentas(m.comandas),
            }))}
          />
        </div>
        <Tabla>
          {porMetodoPago.map((m) => (
            <Fila
              key={m.metodoPago}
              izquierda={ETIQUETA_PAGO[m.metodoPago] ?? m.metodoPago}
              centro={cuentas(m.comandas)}
              derecha={pesos(m.total)}
            />
          ))}
        </Tabla>
      </Bloque>

      <Bloque titulo={platos.length > MAS_VENDIDOS ? `Los ${MAS_VENDIDOS} platos más vendidos` : "Platos más vendidos"}>
        <div className="p-2">
          <BarrasHorizontales
            titulo="Platos más vendidos, por unidades"
            total={resumen.platos}
            filas={platos.slice(0, MAS_VENDIDOS).map((p) => ({
              clave: p.nombre,
              etiqueta: p.nombre,
              valor: p.cantidad,
              texto: `${p.cantidad} und`,
              extra: `Vendido: ${pesos(p.total)}`,
            }))}
          />
        </div>
        <Tabla>
          {platos.map((p) => (
            <Fila key={p.nombre} izquierda={p.nombre} centro={`×${p.cantidad}`} derecha={pesos(p.total)} />
          ))}
        </Tabla>
      </Bloque>
    </>
  );
}

function Consumo({ datos }) {
  if (datos.insumos.length === 0) return <Vacio>No hubo movimientos de inventario en este rango.</Vacio>;

  // Cada insumo tiene su unidad (g, ml, und), así que las barras no comparan
  // cantidades entre sí: muestran qué parte de lo que había se gastó.
  const conGasto = datos.insumos
    .filter((i) => i.neto > 0)
    .map((i) => {
      const habia = i.stockActual + i.neto;
      return { ...i, parte: habia > 0 ? Math.min(i.neto / habia, 1) : 1 };
    })
    .sort((a, b) => b.parte - a.parte);

  return (
    <Bloque titulo="Consumo por insumo">
      {conGasto.length > 0 && (
        <div className="p-2">
          <p className="px-2 pb-1 text-[13px] text-tinta-2">Parte de las existencias que se gastó en este rango.</p>
          <BarrasHorizontales
            titulo="Parte de las existencias gastada, por insumo"
            tope={1}
            filas={conGasto.map((i) => ({
              clave: i.insumoId,
              etiqueta: i.nombre,
              valor: i.parte,
              texto: `${Math.round(i.parte * 100)} %`,
              extra: `Gastado ${cantidad(i.neto)} ${i.unidad}, quedan ${cantidad(i.stockActual)} ${i.unidad}`,
              nota: i.stockActual < 0 ? "Stock en negativo" : i.bajoMinimo ? "Bajo el mínimo" : null,
            }))}
          />
        </div>
      )}
      <Tabla>
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
      </Tabla>
    </Bloque>
  );
}
