import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Aviso, Boton, Cargando, RangoFechas, Selector, Vacio } from "../../components/ui";
import { BarrasHorizontales, SerieTiempo } from "../../components/Barras";
import { useAuth } from "../../context/sesion";
import { cantidad, diaCorto, ETIQUETA_PAGO, hoyISO, pesos, pesosCompactos } from "../../lib/formato";
import { acumular, diasEntre, mediaMovil, mesesAnteriores, rangoComparado, textoVariacion, variacion } from "../../lib/series";

const PESTANAS = [
  { clave: "ventas", texto: "Ventas" },
  { clave: "consumo", texto: "Consumo" },
];

export default function Reportes() {
  const { pedir } = useAuth();
  const [pestana, setPestana] = useState("ventas");
  const [rango, setRango] = useState({ desde: hoyISO(), hasta: hoyISO() });
  // Cómo se está leyendo la gráfica de ventas en el tiempo. Vive aquí porque el
  // informe se vuelve a montar con cada rango y la elección no debe perderse.
  const [analisis, setAnalisis] = useState({ vista: "dia", linea: "puntos", comparar: "" });
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
        (pestana === "ventas" ? (
          <Ventas datos={datos} analisis={analisis} onAnalisis={setAnalisis} />
        ) : (
          <Consumo datos={datos} />
        ))}
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

// Con muchos días los puntos no caben ni se leen: se juntan por mes.
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

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
// "2026-10" -> "octubre de 2026"
const mesLargo = (mes) => `${MESES_LARGOS[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

const VISTAS = [
  { valor: "dia", texto: "Por día" },
  { valor: "acumulado", texto: "Acumulado" },
];
const LINEAS = [
  { valor: "puntos", texto: "Une los puntos" },
  { valor: "tendencia", texto: "Tendencia de 7 días" },
];
const NOMBRE_COMPARADO = { anterior: "Periodo anterior", mes: "Mes pasado" };

// Dos opciones de las que siempre hay una elegida.
function Segmento({ etiqueta, opciones, valor, onCambiar, disabled = false }) {
  return (
    <fieldset disabled={disabled} className="min-w-0 disabled:opacity-50">
      <legend className="mb-1 block text-sm font-semibold text-tinta-2">{etiqueta}</legend>
      <div className="flex">
        {opciones.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={valor === opcion.valor}
            onClick={() => onCambiar(opcion.valor)}
            className={`min-h-12 border px-3 text-[15px] font-bold first:rounded-l-lg last:rounded-r-lg [&:not(:first-child)]:-ml-px ${
              valor === opcion.valor ? "z-[1] border-tinta bg-tinta text-white" : "border-filete bg-mantel text-tinta"
            }`}
          >
            {opcion.texto}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// La variación frente al periodo comparado. El color nunca va solo: lo
// acompañan la flecha y el signo.
function TarjetaVariacion({ actual, base }) {
  const cambio = variacion(actual, base);
  const diferencia = Math.abs(actual - base);
  const Icono = cambio == null || cambio === 0 ? Minus : cambio > 0 ? TrendingUp : TrendingDown;
  const color = cambio == null || cambio === 0 ? "text-tinta-2" : cambio > 0 ? "text-listo" : "text-brasa";
  return (
    <div className="rounded-xl border border-filete bg-white p-3">
      <p className="text-xs text-tinta-2">Variación</p>
      <p className="flex items-center gap-2 text-2xl font-extrabold tracking-[-0.02em] text-tinta">
        <Icono size={22} strokeWidth={2.4} aria-hidden className={color} />
        {cambio == null ? "Sin base" : textoVariacion(cambio)}
      </p>
      <p className="text-[13px] text-tinta-2">
        {cambio == null
          ? "El periodo comparado no tuvo ventas."
          : cambio === 0
            ? "Igual que el periodo comparado."
            : `${pesos(diferencia)} ${cambio > 0 ? "más" : "menos"} que el periodo comparado.`}
      </p>
    </div>
  );
}

/**
 * Las ventas en el tiempo, para analizarlas y no solo verlas:
 *  - Por día o acumulado: el acumulado dice si el periodo va por delante o por
 *    detrás, aunque los días sueltos suban y bajen.
 *  - La línea une los puntos o muestra la tendencia (media móvil de 7 días),
 *    que quita el sube y baja entre semana y fin de semana.
 *  - Se compara con otro periodo del mismo largo: el anterior, las mismas
 *    fechas del mes pasado o cualquier mes del último año.
 *
 * `analisis` (qué se eligió) lo guarda la página: este bloque se vuelve a
 * montar con cada cambio de rango y la elección no debe perderse.
 */
function VentasEnElTiempo({ datos, analisis, onAnalisis }) {
  const { pedir } = useAuth();
  const { porDia, desde, hasta } = datos;
  // El periodo comparado que ya llegó, con las fechas a las que corresponde.
  const [comparado, setComparado] = useState(null);

  // Con fechas, la serie lleva todos los días del rango: un día sin ventas es
  // un cero, no un hueco. Así cada día tiene su pareja al comparar.
  const dias = desde && hasta ? diasEntre(desde, hasta) : null;
  const porMes = (dias?.length ?? porDia.length) > DIAS_POR_COLUMNAS;
  const puedeComparar = Boolean(dias) && !porMes;
  const rango = puedeComparar && analisis.comparar ? rangoComparado(analisis.comparar, desde, hasta) : null;
  const desdeC = rango?.desde;
  const hastaC = rango?.hasta;

  useEffect(() => {
    if (!desdeC) return undefined;
    let vigente = true;
    const clave = `${desdeC}|${hastaC}`;
    pedir(`/api/admin/reportes/ventas?desde=${desdeC}&hasta=${hastaC}`)
      .then((otro) => vigente && setComparado({ clave, porDia: otro.porDia }))
      .catch((err) => vigente && setComparado({ clave, error: err.message }));
    return () => {
      vigente = false;
    };
  }, [pedir, desdeC, hastaC]);

  if (porMes) {
    const meses = agruparPorMes(porDia);
    if (meses.length < 2) return null;
    return (
      <Bloque titulo="Ventas por mes">
        <div className="p-3 pt-8">
          <SerieTiempo
            titulo="Ventas por mes"
            cada="mes"
            formatoEje={pesosCompactos}
            puntos={meses.map((m) => ({
              clave: m.fecha,
              etiqueta: mesCorto(m.fecha),
              valor: m.total,
              texto: pesos(m.total),
              extra: cuentas(m.comandas),
            }))}
          />
        </div>
        <Tabla>
          {meses.map((m) => (
            <Fila key={m.fecha} izquierda={mesLargo(m.fecha)} centro={cuentas(m.comandas)} derecha={pesos(m.total)} />
          ))}
        </Tabla>
      </Bloque>
    );
  }

  const delDia = new Map(porDia.map((d) => [d.fecha, d]));
  const serie = dias ? dias.map((fecha) => delDia.get(fecha) ?? { fecha, comandas: 0, total: 0 }) : porDia;
  if (serie.length < 2) return null;

  const acumulado = analisis.vista === "acumulado";
  const tendencia = !acumulado && analisis.linea === "tendencia";
  const totales = serie.map((d) => d.total);

  // Solo vale la respuesta del periodo que se está pidiendo ahora.
  const recibido = rango && comparado?.clave === `${desdeC}|${hastaC}` ? comparado : null;
  const diasC = rango ? diasEntre(desdeC, hastaC) : [];
  const delDiaC = new Map((recibido?.porDia ?? []).map((d) => [d.fecha, d.total]));
  const totalesC = recibido?.porDia ? diasC.map((fecha) => delDiaC.get(fecha) ?? 0) : null;
  const mesElegido = analisis.comparar ? mesLargo(analisis.comparar) : "";
  const nombreC = NOMBRE_COMPARADO[analisis.comparar] ?? mesElegido.charAt(0).toUpperCase() + mesElegido.slice(1);

  const valores = acumulado ? acumular(totales) : totales;
  const valoresC = totalesC && (acumulado ? acumular(totalesC) : totalesC);
  const media = tendencia ? mediaMovil(totales) : null;
  const suma = (lista) => lista.reduce((total, valor) => total + valor, 0);

  const puntos = serie.map((d, i) => {
    const extra = [acumulado ? `Ese día: ${pesos(d.total)}` : cuentas(d.comandas)];
    if (media) extra.push(`Media de 7 días: ${pesos(Math.round(media[i]))}`);
    if (valoresC) {
      extra.push(`${nombreC}, ${diaCorto(diasC[i])}: ${pesos(valoresC[i])}`);
      extra.push(`Variación: ${textoVariacion(variacion(valores[i], valoresC[i]))}`);
    }
    return {
      clave: d.fecha,
      etiqueta: diaCorto(d.fecha),
      etiquetaCorta: serie.length > 10 ? d.fecha.slice(8) : diaCorto(d.fecha),
      valor: valores[i],
      texto: pesos(valores[i]),
      extra,
    };
  });

  const titulo = acumulado ? "Ventas acumuladas" : "Ventas por día";
  const elegir = (cambios) => onAnalisis({ ...analisis, ...cambios });

  return (
    <Bloque titulo={titulo}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-filete p-3">
        <Segmento etiqueta="Ver" opciones={VISTAS} valor={analisis.vista} onCambiar={(vista) => elegir({ vista })} />
        <Segmento
          etiqueta="Línea"
          opciones={LINEAS}
          valor={acumulado ? "puntos" : analisis.linea}
          onCambiar={(linea) => elegir({ linea })}
          disabled={acumulado}
        />
        {puedeComparar && (
          <Selector
            etiqueta="Comparar con"
            className="min-w-[14rem] flex-1 sm:max-w-xs"
            value={analisis.comparar}
            onChange={(e) => elegir({ comparar: e.target.value })}
            opciones={[
              { valor: "", texto: "Sin comparar" },
              { valor: "anterior", texto: "El periodo anterior" },
              { valor: "mes", texto: "Las mismas fechas del mes pasado" },
              ...mesesAnteriores(desde).map((mes) => ({ valor: mes, texto: mesLargo(mes) })),
            ]}
          />
        )}
      </div>

      {rango && !recibido && <p className="border-b border-filete px-3 py-2 text-sm text-tinta-2">Cargando el periodo comparado…</p>}
      {recibido?.error && (
        <p role="alert" className="border-b border-filete px-3 py-2 text-sm font-semibold text-brasa">
          No se pudo cargar el periodo comparado: {recibido.error}
        </p>
      )}

      {totalesC && (
        <div className="grid gap-2 border-b border-filete p-3 sm:grid-cols-3">
          <Tarjeta titulo={`Este periodo (${diaCorto(desde)} – ${diaCorto(hasta)})`} valor={pesos(suma(totales))} />
          <Tarjeta titulo={`${nombreC} (${diaCorto(desdeC)} – ${diaCorto(hastaC)})`} valor={pesos(suma(totalesC))} />
          <TarjetaVariacion actual={suma(totales)} base={suma(totalesC)} />
        </div>
      )}

      <div className={`p-3 ${totalesC || media ? "" : "pt-8"}`}>
        <SerieTiempo
          titulo={titulo}
          cada="día"
          formatoEje={pesosCompactos}
          puntos={puntos}
          linea={media ?? undefined}
          comparada={valoresC ? (tendencia ? mediaMovil(totalesC) : valoresC) : null}
          leyenda={{
            puntos: acumulado ? "Vendido hasta ese día" : "Venta de cada día",
            linea: media ? "Media de 7 días" : undefined,
            comparada: `${nombreC}${tendencia ? ", media de 7 días" : ""} (${rango ? `${diaCorto(desdeC)} – ${diaCorto(hastaC)}` : ""})`,
          }}
          rotular={acumulado ? "ultimo" : "mayor"}
          conPromedio={!acumulado && !valoresC}
        />
      </div>

      <Tabla>
        {serie.map((d, i) => (
          <Fila
            key={d.fecha}
            izquierda={d.fecha}
            centro={totalesC ? `${nombreC}: ${pesos(totalesC[i])}` : cuentas(d.comandas)}
            derecha={pesos(d.total)}
          />
        ))}
      </Tabla>
    </Bloque>
  );
}

function Ventas({ datos, analisis, onAnalisis }) {
  const { resumen, porMetodoPago, porPlato } = datos;

  if (resumen.comandas === 0) return <Vacio>No hay cuentas cobradas en este rango.</Vacio>;

  const platos = [...porPlato].sort((a, b) => b.cantidad - a.cantidad);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Tarjeta titulo="Vendido" valor={pesos(resumen.total)} />
        <Tarjeta titulo="Cuentas" valor={resumen.comandas} />
        <Tarjeta titulo="Platos" valor={resumen.platos} />
        <Tarjeta titulo="Ticket promedio" valor={pesos(resumen.ticketPromedio)} />
      </div>

      <VentasEnElTiempo datos={datos} analisis={analisis} onAnalisis={onAnalisis} />

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
