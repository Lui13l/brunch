import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/sesion";
import { RutaProtegida } from "./components/Layout";
import { INICIO_POR_ROL } from "./lib/formato";
import Login from "./pages/Login";
import Entrar from "./pages/Entrar";
import Mesas from "./pages/Mesas";
import Comanda from "./pages/Comanda";
import Cocina from "./pages/Cocina";
import Panel from "./pages/admin/Panel";
import Caja from "./pages/admin/Caja";
import Reportes from "./pages/admin/Reportes";
import Platos from "./pages/admin/Platos";
import Insumos from "./pages/admin/Insumos";
import Recetas from "./pages/admin/Recetas";
import MesasAdmin from "./pages/admin/MesasAdmin";
import Pedidos from "./pages/admin/Pedidos";
import Personal from "./pages/admin/Personal";
import Auditoria from "./pages/admin/Auditoria";

const MESERO = ["MESERO", "ADMIN"];
const COCINA = ["COCINA", "ADMIN"];
const ADMIN = ["ADMIN"];

function Inicio() {
  const { user } = useAuth();
  return <Navigate to={user ? (INICIO_POR_ROL[user.rol] ?? "/mesas") : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route
            path="/mesas"
            element={
              <RutaProtegida roles={MESERO}>
                <Mesas />
              </RutaProtegida>
            }
          />
          <Route
            path="/comanda/:id"
            element={
              <RutaProtegida roles={MESERO}>
                <Comanda />
              </RutaProtegida>
            }
          />
          <Route
            path="/cocina"
            element={
              <RutaProtegida roles={COCINA}>
                <Cocina />
              </RutaProtegida>
            }
          />
          <Route
            path="/admin"
            element={
              <RutaProtegida roles={ADMIN}>
                <Panel />
              </RutaProtegida>
            }
          >
            <Route index element={<Navigate to="/admin/caja" replace />} />
            <Route path="caja" element={<Caja />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="platos" element={<Platos />} />
            <Route path="insumos" element={<Insumos />} />
            <Route path="recetas" element={<Recetas />} />
            <Route path="mesas" element={<MesasAdmin />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="personal" element={<Personal />} />
            <Route path="auditoria" element={<Auditoria />} />
          </Route>
          <Route path="*" element={<Inicio />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
