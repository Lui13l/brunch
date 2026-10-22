import { useEffect, useRef } from "react";
import gsap from "gsap";
import "./Hero.css";
import WeatherBadge from "../components/WeatherBadge";

const Hero = () => {
  const heroRef = useRef(null);

  useEffect(() => {
    if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.from(".hero-title", {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      });
      gsap.from(".hero-subtitle", {
        y: 30,
        opacity: 0,
        duration: 1,
        delay: 0.3,
        ease: "power3.out",
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} className="hero is-large hero-bg">
      <video
        loading="lazy"
        preload="none"
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="https://res.cloudinary.com/dwhezsxkg/video/upload/v1778019228/homebrunchie_gd2laf.mp4" type="video/mp4" />
      </video>
      <WeatherBadge />
      <div className="overlay">
        <div className="hero-body has-text-centered">
          <h1 className="title has-text-white hero-title">Brunch & Co.</h1>
          <p className="subtitle has-text-white hero-subtitle">
            Donde cada mañana se convierte en una experiencia especial
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
