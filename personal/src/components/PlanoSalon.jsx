import { useImperativeHandle, useRef, useState } from "react";
import MesaIlustracion from "./MesaIlustracion";
import { LADO, cabe, huella } from "../lib/plano";

// El salón visto desde arriba: una cuadrícula cuadrada con cada mesa en su
// lugar. El mismo dibujo sirve a los dos: el administrador arrastra las mesas
// (`editable`) y el mesero las toca para abrir o entrar a la cuenta.
//
// Al arrastrar, la mesa sigue al puntero libremente y una silueta marca la
// celda donde caería (verde si cabe, roja si no). Al soltarla se acomoda sola
// en esa celda, o vuelve a su sitio si no cabía.

const porciento = (celdas) => `${(celdas / LADO) * 100}%`;
const acotar = (valor, minimo, maximo) => Math.min(Math.max(valor, minimo), maximo);

const FLECHAS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

// Cuánto hay que mover el puntero para que cuente como arrastre y no como toque.
const UMBRAL = 5;

// Dónde caería una mesa: la silueta se desliza de celda en celda.
function Silueta({ mesa, x, y, valida }) {
  const tamano = huella(mesa);
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute rounded-lg border-2 border-dashed transition-[left,top,background-color,border-color] duration-100 ease-out ${
        valida ? "border-listo bg-listo/15" : "border-brasa bg-brasa/15"
      }`}
      style={{ left: porciento(x), top: porciento(y), width: porciento(tamano.ancho), height: porciento(tamano.alto) }}
    />
  );
}

/**
 * @param mesas Solo las que están ubicadas (x e y con valor).
 * @param pielDe (mesa) => clases de color de la mesa.
 * @param detalleDe (mesa) => texto corto bajo el número (por ejemplo el total).
 * @param nombreDe (mesa) => cómo se lee la mesa en voz alta.
 * @param onPulsar (mesa) => se tocó una mesa (sin arrastrarla).
 * @param deshabilitada (mesa) => true si no se puede tocar.
 * @param editable El administrador puede mover las mesas.
 * @param seleccion id de la mesa elegida en el editor.
 * @param onMover (mesa, x, y) => la mesa se soltó en un lugar libre.
 * @param ref Para traer una mesa desde fuera del plano (la bandeja "Sin
 *   ubicar"): `apuntar(mesa, clientX, clientY)` muestra dónde caería y
 *   `soltar()` la deja ahí si cabe.
 */
export default function PlanoSalon({
  mesas,
  pielDe,
  detalleDe,
  nombreDe = (mesa) => `Mesa ${mesa.numero}`,
  onPulsar,
  deshabilitada = () => false,
  editable = false,
  seleccion = null,
  onMover,
  ref,
}) {
  const lienzo = useRef(null);
  // Dónde se agarró la mesa, para que no salte bajo el dedo al empezar.
  const agarre = useRef(null);
  // Un arrastre termina con un "click" del navegador: no debe contar como toque.
  const acabaDeArrastrar = useRef(false);
  const [arrastre, setArrastre] = useState(null);
  // Mesa que viene de fuera del plano y todavía no se ha soltado.
  const [entrante, setEntrante] = useState(null);

  const otras = (mesa) => mesas.filter((otra) => otra.id !== mesa.id);

  // La celda más cercana a un punto del lienzo (en píxeles), sin salirse.
  const celdaEn = (mesa, izquierda, arriba, marco) => {
    const celda = marco.width / LADO;
    const tamano = huella(mesa);
    return {
      x: acotar(Math.round(izquierda / celda), 0, LADO - tamano.ancho),
      y: acotar(Math.round(arriba / celda), 0, LADO - tamano.alto),
    };
  };

  useImperativeHandle(ref, () => ({
    apuntar(mesa, clientX, clientY) {
      const marco = lienzo.current.getBoundingClientRect();
      const celda = marco.width / LADO;
      const fuera = clientX < marco.left || clientX > marco.right || clientY < marco.top || clientY > marco.bottom;
      if (fuera) {
        setEntrante(null);
        return { celda, dentro: false };
      }
      // La mesa cuelga del puntero por su centro.
      const tamano = huella(mesa);
      const lugar = celdaEn(
        mesa,
        clientX - marco.left - (tamano.ancho * celda) / 2,
        clientY - marco.top - (tamano.alto * celda) / 2,
        marco,
      );
      const valida = cabe({ ...mesa, ...lugar }, otras(mesa));
      setEntrante({ mesa, ...lugar, valida });
      return { celda, dentro: true, valida };
    },
    soltar() {
      const destino = entrante;
      setEntrante(null);
      if (!destino?.valida) return false;
      onMover?.(destino.mesa, destino.x, destino.y);
      return true;
    },
  }));

  const alAgarrar = (evento, mesa) => {
    if (!editable) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const marco = evento.currentTarget.getBoundingClientRect();
    agarre.current = {
      id: mesa.id,
      dx: evento.clientX - marco.left,
      dy: evento.clientY - marco.top,
      x0: evento.clientX,
      y0: evento.clientY,
    };
    acabaDeArrastrar.current = false;
  };

  const alArrastrar = (evento, mesa) => {
    const tomada = agarre.current;
    if (tomada?.id !== mesa.id) return;
    if (!arrastre && Math.hypot(evento.clientX - tomada.x0, evento.clientY - tomada.y0) < UMBRAL) return;

    const marco = lienzo.current.getBoundingClientRect();
    const celda = marco.width / LADO;
    const tamano = huella(mesa);
    // Posición libre, en píxeles, sin dejar que la mesa se salga del plano.
    const izquierda = acotar(evento.clientX - marco.left - tomada.dx, 0, marco.width - tamano.ancho * celda);
    const arriba = acotar(evento.clientY - marco.top - tomada.dy, 0, marco.height - tamano.alto * celda);
    const lugar = celdaEn(mesa, izquierda, arriba, marco);
    setArrastre({ id: mesa.id, izquierda, arriba, ...lugar, valida: cabe({ ...mesa, ...lugar }, otras(mesa)) });
  };

  const alSoltar = (mesa) => {
    if (agarre.current?.id !== mesa.id) return;
    agarre.current = null;
    if (!arrastre) return;
    acabaDeArrastrar.current = true;
    if (arrastre.valida && (arrastre.x !== mesa.x || arrastre.y !== mesa.y)) onMover?.(mesa, arrastre.x, arrastre.y);
    setArrastre(null);
  };

  const alPulsar = (mesa) => {
    if (acabaDeArrastrar.current) {
      acabaDeArrastrar.current = false;
      return;
    }
    onPulsar?.(mesa);
  };

  const conTeclado = (evento, mesa) => {
    const paso = FLECHAS[evento.key];
    if (!editable || !paso) return;
    evento.preventDefault();
    const destino = { ...mesa, x: mesa.x + paso[0], y: mesa.y + paso[1] };
    if (cabe(destino, otras(mesa))) onMover?.(mesa, destino.x, destino.y);
  };

  const arrastrada = arrastre && mesas.find((mesa) => mesa.id === arrastre.id);

  return (
    <div
      ref={lienzo}
      className={`relative aspect-square w-full overflow-hidden rounded-lg border-2 bg-mantel transition-colors duration-150 ${
        arrastre || entrante ? "border-caramelo" : "border-filete"
      }`}
      style={{
        // La cuadrícula solo se dibuja para quien arma el plano.
        backgroundImage: editable
          ? "linear-gradient(to right, var(--color-filete) 1px, transparent 1px), linear-gradient(to bottom, var(--color-filete) 1px, transparent 1px)"
          : undefined,
        backgroundSize: `${100 / LADO}% ${100 / LADO}%`,
      }}
    >
      {arrastrada && <Silueta mesa={arrastrada} x={arrastre.x} y={arrastre.y} valida={arrastre.valida} />}
      {entrante && <Silueta mesa={entrante.mesa} x={entrante.x} y={entrante.y} valida={entrante.valida} />}

      {mesas.map((mesa) => {
        const movida = arrastre?.id === mesa.id ? arrastre : null;
        const tamano = huella(mesa);
        const detalle = detalleDe?.(mesa);
        return (
          <button
            key={mesa.id}
            type="button"
            data-sin-hover={editable ? true : undefined}
            disabled={deshabilitada(mesa)}
            aria-label={detalle ? `${nombreDe(mesa)}, ${detalle}` : nombreDe(mesa)}
            aria-pressed={editable ? seleccion === mesa.id : undefined}
            onClick={() => alPulsar(mesa)}
            onPointerDown={(evento) => alAgarrar(evento, mesa)}
            onPointerMove={(evento) => alArrastrar(evento, mesa)}
            onPointerUp={() => alSoltar(mesa)}
            onPointerCancel={() => alSoltar(mesa)}
            onKeyDown={(evento) => conTeclado(evento, mesa)}
            // En el aire la mesa sigue al puntero sin retraso; al soltarla (o al
            // moverla con el teclado o girarla) se desliza hasta su celda.
            className={`absolute flex animate-[mesa-llega_220ms_ease-out_both] items-center justify-center rounded-lg p-[2px] disabled:opacity-40 ${pielDe(mesa)} ${
              editable ? "touch-none" : ""
            } ${
              movida
                ? "z-10 scale-105 -rotate-2 cursor-grabbing shadow-xl transition-[scale,rotate,box-shadow] duration-100"
                : `transition-[left,top,width,height,scale,rotate,box-shadow] duration-200 ease-[cubic-bezier(0.2,1.4,0.4,1)] ${
                    editable ? "cursor-grab hover:shadow-md" : ""
                  }`
            } ${editable && seleccion === mesa.id && !movida ? "outline-3 outline-caramelo" : ""}`}
            style={{
              left: movida ? movida.izquierda : porciento(mesa.x),
              top: movida ? movida.arriba : porciento(mesa.y),
              width: porciento(tamano.ancho),
              height: porciento(tamano.alto),
            }}
          >
            <MesaIlustracion
              capacidad={mesa.capacidad}
              forma={mesa.forma}
              rotacion={mesa.rotacion}
              className="absolute inset-0 size-full"
            />
            <span className="relative text-center leading-none">
              <span className="block text-[clamp(0.9rem,3.2vw,1.5rem)] font-extrabold tracking-[-0.03em]">{mesa.numero}</span>
              {detalle && <span className="mt-0.5 block text-[clamp(0.6rem,1.8vw,0.8rem)] font-bold">{detalle}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
