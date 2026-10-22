import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import Favorites from "../components/Favorites";
import MapSection from "../components/MapSection";
import Footer from "../components/Footer";
import SandwichFalling from "../components/SandwichFalling";

const Home = () => {
  return (
    <>
      <SandwichFalling />
      <Navbar />
      <Hero />
      <Features />
      <Favorites />
      <MapSection />
      <Footer />
    </>
  );
};

export default Home;