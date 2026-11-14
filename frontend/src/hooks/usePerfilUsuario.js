import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { actualizarPerfil } from "../services/usuarioService";
import { misPedidos, obtenerPedido } from "../services/pedidosService";
import { actualizarReserva, cancelarReserva, misReservas } from "../services/reservasService";

const FORMULARIO_INICIAL = (user) => ({
  nombre: user?.nombre || "",
  direccion: user?.direccion || "",
  celular: user?.celular || "",
  password: "",
  confirmarPassword: "",
});

export default function usePerfilUsuario() {
  const [seccion, setSeccion] = useState("perfil");
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => FORMULARIO_INICIAL(user));
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [errorPedidos, setErrorPedidos] = useState("");
  const [reservas, setReservas] = useState([]);
  const [cargandoReservas, setCargandoReservas] = useState(false);
  const [errorReservas, setErrorReservas] = useState("");
  const [reservaCancelandoId, setReservaCancelandoId] = useState(null);
  const [reservaGuardandoId, setReservaGuardandoId] = useState(null);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");
  const solicitudDetalle = useRef(0);

  useEffect(() => {
    let activo = true;

    const cargarPedidos = async () => {
      setCargandoPedidos(true);
      setErrorPedidos("");
      try {
        const resultado = await misPedidos();
        if (activo) setPedidos(resultado);
      } catch (err) {
        if (activo) setErrorPedidos(err.message);
      } finally {
        if (activo) setCargandoPedidos(false);
      }
    };

    const cargarReservas = async () => {
      setCargandoReservas(true);
      setErrorReservas("");
      try {
        const resultado = await misReservas();
        if (activo) setReservas(resultado);
      } catch (err) {
        if (activo) setErrorReservas(err.message);
      } finally {
        if (activo) setCargandoReservas(false);
      }
    };

    if (seccion === "pedidos") cargarPedidos();
    if (seccion === "reservas") cargarReservas();

    return () => {
      activo = false;
    };
  }, [seccion]);

  const cambiarCampo = (event) => {
    const { name, value } = event.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  };

  const guardarPerfil = async (event) => {
    event.preventDefault();
    setError("");
    setMensaje("");

    if (form.password && form.password.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.password !== form.confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre,
        direccion: form.direccion,
        celular: form.celular,
        ...(form.password ? { password: form.password } : {}),
      };
      setUser(await actualizarPerfil(datos));
      setForm((actual) => ({ ...actual, password: "", confirmarPassword: "" }));
      setMensaje("Tu perfil se actualizó correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesion = async () => {
    setError("");
    setCerrandoSesion(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
      setSeccion("perfil");
      setCerrandoSesion(false);
    }
  };

  const abrirDetallePedido = async (pedido) => {
    const solicitudActual = ++solicitudDetalle.current;
    setPedidoSeleccionado(pedido);
    setCargandoDetalle(true);
    setErrorDetalle("");
    try {
      const detalle = await obtenerPedido(pedido._id);
      if (solicitudDetalle.current === solicitudActual) setPedidoSeleccionado(detalle);
    } catch (err) {
      if (solicitudDetalle.current === solicitudActual) setErrorDetalle(err.message);
    } finally {
      if (solicitudDetalle.current === solicitudActual) setCargandoDetalle(false);
    }
  };

  const cerrarDetallePedido = () => {
    solicitudDetalle.current += 1;
    setPedidoSeleccionado(null);
    setCargandoDetalle(false);
    setErrorDetalle("");
  };

  const cancelarReservaPerfil = async (reserva) => {
    const dia = reserva.dia?.slice(0, 10);
    if (!window.confirm(`¿Cancelar tu reserva del ${dia} a las ${reserva.hora}?`)) return;

    setErrorReservas("");
    setReservaCancelandoId(reserva._id);
    try {
      const actualizada = await cancelarReserva(reserva._id);
      setReservas((actuales) => actuales.map((item) => (item._id === actualizada._id ? actualizada : item)));
    } catch (err) {
      setErrorReservas(err.message);
    } finally {
      setReservaCancelandoId(null);
    }
  };

  const editarReservaPerfil = async (id, datos) => {
    setErrorReservas("");
    setReservaGuardandoId(id);
    try {
      const actualizada = await actualizarReserva(id, datos);
      setReservas((actuales) => actuales.map((item) => (item._id === actualizada._id ? actualizada : item)));
      return true;
    } catch (err) {
      setErrorReservas(err.message);
      return false;
    } finally {
      setReservaGuardandoId(null);
    }
  };

  return {
    seccion,
    setSeccion,
    user,
    form,
    cambiarCampo,
    guardarPerfil,
    error,
    mensaje,
    guardando,
    cerrarSesion,
    cerrandoSesion,
    pedidos,
    cargandoPedidos,
    errorPedidos,
    reservas,
    cargandoReservas,
    errorReservas,
    reservaCancelandoId,
    cancelarReservaPerfil,
    reservaGuardandoId,
    editarReservaPerfil,
    pedidoSeleccionado,
    cargandoDetalle,
    errorDetalle,
    abrirDetallePedido,
    cerrarDetallePedido,
  };
}
