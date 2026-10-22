import { BrowserRouter, Routes, Route } from 'react-router-dom';
import 'bulma/css/bulma.min.css';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import CartDrawer from './components/CartDrawer';
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

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <ScrollToTop />
          <CartDrawer />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/login" element={<Login />} />
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
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
