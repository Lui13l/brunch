import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import CartDrawer from './components/CartDrawer';
import CartFloatingButton from './components/CartFloatingButton';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Menu from './pages/Menu';
import ContactUs from './pages/ContactUs';
import AboutUs from './pages/AboutUs';
import Login from './pages/Login';
import Reservas from './pages/Reservas';
import ReservaExitosa from './pages/ReservaExitosa';
import Checkout from './pages/Checkout';
import PedidoExitoso from './pages/PedidoExitoso';
import PerfilUsuario from './pages/PerfilUsuario';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
import AdminPedidos from './pages/admin/AdminPedidos';
import AdminMenu from './pages/admin/AdminMenu';
import AdminCategorias from './pages/admin/AdminCategorias';
import AdminReservas from './pages/admin/AdminReservas';
import AdminPagos from './pages/admin/AdminPagos';
import AdminDomiciliarios from './pages/admin/AdminDomiciliarios';
import AdminUsuarios from './pages/admin/AdminUsuarios';
import AdminChatbot from './pages/admin/AdminChatbot';
import AdminAuditoria from './pages/admin/AdminAuditoria';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <ScrollToTop />
          <CartDrawer />
          <CartFloatingButton />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <PerfilUsuario />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route path="/pedido-exitoso" element={<PedidoExitoso />} />
            <Route
              path="/reservas"
              element={
                <ProtectedRoute>
                  <Reservas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reserva-exitosa"
              element={
                <ProtectedRoute>
                  <ReservaExitosa />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<Navigate to="/admin/pedidos" replace />} />
              <Route path="pedidos" element={<AdminPedidos />} />
              <Route path="menu" element={<AdminMenu />} />
              <Route path="categorias" element={<AdminCategorias />} />
              <Route path="reservas" element={<AdminReservas />} />
              <Route path="pagos" element={<AdminPagos />} />
              <Route path="domiciliarios" element={<AdminDomiciliarios />} />
              <Route path="usuarios" element={<AdminUsuarios />} />
              <Route path="chatbot" element={<AdminChatbot />} />
              <Route path="auditoria" element={<AdminAuditoria />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
