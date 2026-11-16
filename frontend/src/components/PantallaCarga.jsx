import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import pancito from "../assets/pancito-loader-set-transparente.webp";
import hojaPancito from "../assets/pancito-sprite-set-transparente.webp";
import "./PantallaCarga.css";

// La hoja trae 8 cuadros del pancito caminando, en 4 columnas y 2 filas.
const COLUMNAS = 4;
const CUADROS = 8;

const sinMovimiento = () => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Pantalla de carga: un telón que tapa la página, el pancito caminando
 * mientras se espera y el telón que se va. Hace las veces de transición entre
 * páginas: quien la pide cambia de página cuando ya está cubierta
 * (`onCubierta`), así el cambio nunca se ve a medias.
 *
 * Todo corre en una sola línea de tiempo de GSAP, en este orden:
 *  1. Entrada: dos telones suben uno detrás del otro (primero el caramelo,
 *     después la crema) y sobre ellos aparecen el plato, el pancito y el texto.
 *  2. Espera: el pancito camina sin moverse del sitio; lo que se mueve es el
 *     suelo. La barra se va llenando como un pan que se tuesta.
 *  3. Salida: el pancito da un saltito y los telones se van por arriba.
 *
 * @param mensaje Qué se está esperando ("Preparando tu mesa…").
 * @param inmediata La página ya está en blanco debajo: el telón aparece puesto, sin subir.
 * @param espera Segundos que se queda después de cubrir.
 * @param onCubierta La pantalla ya tapa todo.
 * @param onTerminada Ya se fue: quien la puso puede quitarla.
 */
export default function PantallaCarga({ mensaje, inmediata = false, espera = 0.9, onCubierta, onTerminada }) {
  const raiz = useRef(null);
  // Los avisos se leen de una referencia: si el padre los cambia a mitad de
  // camino, la animación no tiene que empezar de nuevo.
  const avisos = useRef({ onCubierta, onTerminada });
  useLayoutEffect(() => {
    avisos.current = { onCubierta, onTerminada };
  });

  useLayoutEffect(() => {
    const contexto = gsap.context(() => {
      const telones = gsap.utils.toArray(".carga-telon");
      const letras = gsap.utils.toArray(".carga-letra");
      const pan = raiz.current.querySelector(".carga-pan");
      const cubierta = () => avisos.current.onCubierta?.();
      const terminada = () => avisos.current.onTerminada?.();

      // Sin animaciones: la pantalla aparece y se va con un fundido, y el
      // pancito se queda quieto.
      if (sinMovimiento()) {
        gsap
          .timeline({ onComplete: terminada })
          .fromTo(raiz.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: inmediata ? 0 : 0.2 })
          .call(cubierta)
          .to(raiz.current, { autoAlpha: 0, duration: 0.2 }, `+=${espera}`);
        return;
      }

      // --- Lo que se repite mientras se espera ---
      // Los cuadros de la hoja, uno tras otro. `steps` salta de cuadro en
      // cuadro en vez de deslizar la hoja.
      const cuadro = { n: 0 };
      gsap.to(cuadro, {
        n: CUADROS,
        duration: 0.85,
        ease: `steps(${CUADROS})`,
        repeat: -1,
        onUpdate: () => {
          const actual = Math.floor(cuadro.n) % CUADROS;
          pan.style.backgroundPosition = `${((actual % COLUMNAS) / (COLUMNAS - 1)) * 100}% ${Math.floor(actual / COLUMNAS) * 100}%`;
        },
      });
      // Sube y baja al ritmo de los pasos, y su sombra se encoge cuando sube.
      gsap.to(".carga-pan-caja", { y: -7, duration: 0.2125, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.to(".carga-sombra", { scaleX: 0.86, opacity: 0.55, duration: 0.2125, ease: "sine.inOut", repeat: -1, yoyo: true });
      // El suelo corre hacia atrás: por eso parece que avanza.
      gsap.to(".carga-suelo", { backgroundPositionX: "-=44px", duration: 0.5, ease: "none", repeat: -1 });
      gsap.to(".carga-plato-borde", { rotation: 360, duration: 14, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
      // Una ola que recorre las letras del mensaje.
      gsap.to(letras, {
        y: -5,
        duration: 0.42,
        ease: "sine.inOut",
        stagger: { each: 0.045, repeat: -1, yoyo: true },
        delay: 0.9,
      });

      // --- Entrada, espera y salida ---
      const tapado = "inset(0% 0% 0% 0%)";
      const tl = gsap.timeline({ defaults: { ease: "power3.inOut" }, onComplete: terminada });

      if (inmediata) {
        tl.set(telones, { clipPath: tapado }).call(cubierta);
      } else {
        // Suben desde abajo, el segundo pisándole los talones al primero.
        tl.fromTo(telones, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: tapado, duration: 0.55, stagger: 0.11 }).call(cubierta);
      }

      tl.addLabel("contenido", inmediata ? 0 : 0.42)
        .fromTo(".carga-plato", { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.55, ease: "back.out(1.6)" }, "contenido")
        .fromTo(
          ".carga-pan-caja",
          { autoAlpha: 0, scale: 0.6, rotation: -14 },
          { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.6, ease: "back.out(2)" },
          "contenido+=0.08",
        )
        .fromTo(".carga-suelo, .carga-sombra", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, "contenido+=0.2")
        .fromTo(
          letras,
          { autoAlpha: 0, yPercent: 90, rotation: 8 },
          { autoAlpha: 1, yPercent: 0, rotation: 0, duration: 0.45, ease: "back.out(1.8)", stagger: 0.022 },
          "contenido+=0.2",
        )
        .fromTo(".carga-barra", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, "contenido+=0.3")
        // Se llena rápido al principio y cada vez más despacio: nunca parece atascada.
        .fromTo(
          ".carga-barra-relleno",
          { scaleX: 0 },
          { scaleX: 0.88, duration: Math.max(espera, 0.4) + 0.4, ease: "power2.out" },
          "contenido+=0.3",
        );

      // La salida empieza `espera` segundos después de haber cubierto.
      tl.addLabel("salida", (inmediata ? 0 : 0.66) + espera)
        .to(".carga-barra-relleno", { scaleX: 1, duration: 0.2, ease: "power1.out", overwrite: true }, "salida")
        // El saltito: se agacha, sale estirado y se despide girando un poco.
        .to(".carga-pan-escala", { scaleY: 0.86, scaleX: 1.1, duration: 0.11, ease: "power1.in", transformOrigin: "50% 100%" }, "salida")
        .to(".carga-pan-escala", { scaleY: 1.1, scaleX: 0.93, y: -46, rotation: 9, duration: 0.24, ease: "power2.out" }, ">")
        .to(".carga-contenido", { autoAlpha: 0, y: -22, duration: 0.26, ease: "power2.in" }, ">-0.06")
        // Se van por arriba en el orden contrario: primero la crema, que deja
        // ver un instante el caramelo, y después el caramelo.
        .to([...telones].reverse(), { clipPath: "inset(0% 0% 100% 0%)", duration: 0.55, stagger: 0.11 }, ">-0.12");
    }, raiz);

    return () => contexto.revert();
  }, [inmediata, espera]);

  return (
    <div ref={raiz} className="carga" role="status" aria-live="polite">
      <div className="carga-telon carga-telon--caramelo" />
      <div className="carga-telon carga-telon--crema" />

      <div className="carga-contenido">
        <div className="carga-escena">
          <div className="carga-plato">
            <svg className="carga-plato-borde" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="47" />
            </svg>
          </div>
          <div className="carga-pan-caja">
            <div className="carga-pan-escala">
              {/* Con animaciones, la hoja de cuadros; sin ellas, el pancito quieto. */}
              <div className="carga-pan" style={{ backgroundImage: `url(${hojaPancito})` }} />
              <img className="carga-pan-quieto" src={pancito} alt="" />
            </div>
          </div>
          <div className="carga-sombra" />
          <div className="carga-suelo" />
        </div>

        {/* Quien usa lector de pantalla oye la frase entera, no letra por letra. */}
        <p className="carga-mensaje">
          <span className="carga-solo-lector">{mensaje}</span>
          <span aria-hidden="true">
            {[...mensaje].map((letra, i) => (
              <span key={i} className="carga-letra">
                {letra === " " ? " " : letra}
              </span>
            ))}
          </span>
        </p>
        <div className="carga-barra" aria-hidden="true">
          <div className="carga-barra-relleno" />
        </div>
      </div>
    </div>
  );
}
