import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PerfilSidebar from "../components/perfil/PerfilSidebar";
import PerfilForm from "../components/perfil/PerfilForm";
import { HistorialPedidos, HistorialReservas } from "../components/perfil/HistorialCuenta";
import DetallePedidoModal from "../components/perfil/DetallePedidoModal";
import usePerfilUsuario from "../hooks/usePerfilUsuario";
import "./PerfilUsuario.css";

const PerfilUsuario = () => {
  const cuenta = usePerfilUsuario();

  return (
    <>
      <Navbar />
      <main className="perfil-main">
        <div className="perfil-layout">
          <PerfilSidebar
            user={cuenta.user}
            seccion={cuenta.seccion}
            onCambiar={cuenta.setSeccion}
            onCerrarSesion={cuenta.cerrarSesion}
            cerrandoSesion={cuenta.cerrandoSesion}
            guardando={cuenta.guardando}
          />
          <section className="perfil-content" aria-label="Contenido de cuenta">
            {cuenta.seccion === "perfil" && (
              <PerfilForm
                user={cuenta.user}
                form={cuenta.form}
                onChange={cuenta.cambiarCampo}
                onSubmit={cuenta.guardarPerfil}
                error={cuenta.error}
                mensaje={cuenta.mensaje}
                guardando={cuenta.guardando}
                cerrandoSesion={cuenta.cerrandoSesion}
              />
            )}
            {cuenta.seccion === "pedidos" && (
              <HistorialPedidos
                pedidos={cuenta.pedidos}
                cargando={cuenta.cargandoPedidos}
                error={cuenta.errorPedidos}
                onVerDetalle={cuenta.abrirDetallePedido}
              />
            )}
            {cuenta.seccion === "reservas" && (
              <HistorialReservas
                reservas={cuenta.reservas}
                cargando={cuenta.cargandoReservas}
                error={cuenta.errorReservas}
                onCancelar={cuenta.cancelarReservaPerfil}
                cancelandoId={cuenta.reservaCancelandoId}
                onEditar={cuenta.editarReservaPerfil}
                guardandoId={cuenta.reservaGuardandoId}
              />
            )}
          </section>
        </div>
      </main>
      <DetallePedidoModal
        pedido={cuenta.pedidoSeleccionado}
        cargando={cuenta.cargandoDetalle}
        error={cuenta.errorDetalle}
        onCerrar={cuenta.cerrarDetallePedido}
      />
      <Footer />
    </>
  );
};

export default PerfilUsuario;
