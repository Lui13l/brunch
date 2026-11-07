import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Solo para administradores: sin sesión manda al login; con otra cuenta, al inicio.
const AdminRoute = ({ children }) => {
  const { user, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.rol_id !== "admin") return <Navigate to="/" replace />;
  return children;
};

export default AdminRoute;
