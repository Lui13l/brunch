import { useEffect, useState } from "react";
import { ChefHat, LayoutGrid } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Cabecera, Pantalla } from "../../components/Layout";
import { useWebSocket } from "../../hooks/useWebSocket";
import { sonarPedidoWeb } from "../../lib/aviso";

// El admin también atiende y cocina cuando hace falta, así que desde aquí se
// llega al salón y a la cocina sin cerrar sesión.
const ATAJOS = [
  { a: "/mesas", texto: "Salón", Icono: LayoutGrid },
  { a: "/cocina", texto: "Cocina", Icono: ChefHat },
];

const SECCIONES = [
  { a: "/admin/caja", texto: "Caja" },
  { a: "/admin/pedidos", texto: "Pedidos web" },
  { a: "/admin/reportes", texto: "Reportes" },
  { a: "/admin/platos", texto: "Platos" },
  { a: "/admin/insumos", texto: "Insumos" },
  { a: "/admin/recetas", texto: "Recetas" },
  { a: "/admin/mesas", texto: "Mesas" },
  { a: "/admin/personal", texto: "Personal" },
  { a: "/admin/auditoria", texto: "Auditoría" },
];

const PEDIDOS = "/admin/pedidos";
const TOPICS_PEDIDOS = ["/topic/admin/pedidos"];

export default function Panel() {
  const { pathname } = useLocation();
  const [sinVer, setSinVer] = useState(0);

  // El aviso de pedido web nuevo suena desde aquí (una sola vez) en cualquier
  // sección del panel; fuera de Pedidos web se acumula en un contador.
  useWebSocket("/ws", TOPICS_PEDIDOS, () => {
    sonarPedidoWeb();
    if (window.location.pathname !== PEDIDOS) setSinVer((n) => n + 1);
  });

  useEffect(() => {
    if (pathname === PEDIDOS) setSinVer(0);
  }, [pathname]);

  return (
    <Pantalla>
      <Cabecera
        titulo="Administración"
        acciones={
          <div className="flex gap-1">
            {ATAJOS.map((atajo) => (
              <Link
                key={atajo.a}
                to={atajo.a}
                title={atajo.texto}
                className="flex size-10 items-center justify-center rounded-lg text-white/80 active:bg-white/15"
              >
                <atajo.Icono size={20} />
              </Link>
            ))}
          </div>
        }
      />

      <nav className="flex gap-1 overflow-x-auto border-b border-filete bg-mantel px-3 py-2">
        {SECCIONES.map(({ a, texto }) => (
          <NavLink
            key={a}
            to={a}
            className={({ isActive }) =>
              `min-h-10 shrink-0 rounded-lg px-4 py-2 text-[15px] font-bold transition ${
                isActive ? "bg-rio text-white" : "text-tinta-2 active:bg-sala"
              }`
            }
          >
            {texto}
            {a === PEDIDOS && sinVer > 0 && (
              <span className="ml-2 rounded-full bg-brasa px-2 py-0.5 text-[12px] text-white tabular-nums">{sinVer}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </Pantalla>
  );
}
