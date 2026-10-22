import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Al cambiar de página vuelve arriba (el router mantiene el scroll de la página anterior).
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
