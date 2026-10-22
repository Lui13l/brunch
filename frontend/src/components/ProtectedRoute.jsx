import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Sin sesión manda al login y, al entrar, vuelve a la página que se pidió.
const ProtectedRoute = ({ children }) => {
  const { user, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return null;
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
};

export default ProtectedRoute;
