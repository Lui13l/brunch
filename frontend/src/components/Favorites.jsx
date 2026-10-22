import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import brunch from "../assets/brunch.jpg";
import tostada from "../assets/tostada.jpg";
import "./Favorites.css";

// Fotos de productos: se sirven desde frontend/public/menu (las mismas del menú).
const pancakes = "/menu/pancakes.jpg";
const avocado = "/menu/avocado.jpg";
const eggs = "/menu/eggs.jpg";
const icecream = "/menu/helado.jpg";
const latte = "/menu/latte.jpg";
const macaroni = "/menu/macaroni.jpg";
const redvelvet = "/menu/redvelvet.jpg";
const smoothie = "/menu/smoothie.jpg";
const soda = "/menu/soda.jpg";

gsap.registerPlugin(ScrollTrigger);

const Favorites = () => {
  const sectionRef = useRef(null);

  const items = [
    { name: "Pancakes", img: pancakes },
    { name: "Soda de Café", img: soda },
    { name: "Avocado Toast", img: avocado },
    { name: "Coffe Latte", img: latte },
    { name: "Macaroni", img: macaroni },
    { name: "Eggs Benedict", img: eggs },
    { name: "Smoothie", img: smoothie },
    { name: "Pancakes", img: pancakes },
    { name: "Ice cream", img: icecream },
    { name: "Avocado Toast", img: avocado },
    { name: "Cupcake", img: redvelvet },
    { name: "Eggs Benedict", img: eggs },
    { name: "brunch", img: brunch },  
   
    
    { name: "Tostada de la casa", img: tostada },
  ];

  useEffect(() => {
    if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {

      gsap.from(".fav-title", {
        scrollTrigger: { trigger: ".fav-title", start: "top 85%", once: true },
        y: 25,
        opacity: 0,
        duration: 0.45,
        ease: "power2.out",
      });

      gsap.from(".fav-btn", {
        scrollTrigger: { trigger: ".fav-btn", start: "top 95%", once: true },
        y: 15,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
      });

      const cards = gsap.utils.toArray(".fav-card");
      const total = cards.length;
      const angle = 360 / total;
      const radius = 420;

      cards.forEach((card, i) => {
        gsap.set(card, {
          rotationY: i * angle,
          transformOrigin: `50% 50% -${radius}px`,
          z: radius,
        });
      });

      const tween = gsap.to(".carousel", {
        rotationY: "+=360",
        duration: 35,
        repeat: -1,
        ease: "none",
      });

      // ⏸ pausa al hover
      const carousel = document.querySelector(".carousel");
      carousel.addEventListener("mouseenter", () => tween.pause());
      carousel.addEventListener("mouseleave", () => tween.resume());

    }, sectionRef);

    const onLoad = () => ScrollTrigger.refresh();
    globalThis.addEventListener("load", onLoad);

    return () => {
      ctx.revert();
      globalThis.removeEventListener("load", onLoad);
    };
  }, []);

  return (
    <section ref={sectionRef} className="section favorites-section">
      <div className="container has-text-centered">
        
        <h2 className="title is-4 fav-title">Nuestros Favoritos</h2>


        <div className="carousel-container mt-5">
          <div className="carousel">
            {items.map((item, index) => (
              <div
                className="fav-card"
                key={index}
                onClick={(e) => {
                  e.currentTarget.classList.toggle("flipped");
                }}
              >
                <div className="fav-card-inner">

                  {/* FRONT */}
                  <div className="fav-card-front card custom-card">
                    <div className="card-image">
                      <figure className="image is-4by3">
                        <img src={item.img} alt={item.name} loading="lazy" />
                      </figure>
                    </div>

                    <div className="card-content">
                      <p>{item.name}</p>
                    </div>
                  </div>

                  {/* BACK */}
                  <div className="fav-card-back">
                    <h3>{item.name}</h3>

                    <p>
                      Delicioso brunch preparado con ingredientes frescos y
                      sabores artesanales.
                    </p>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>

        <Link to="/menu" className="button is-black is-rounded mt-5 fav-btn">
          Ver menú completo
        </Link>

      </div>
    </section>
    
  );
};

export default Favorites;