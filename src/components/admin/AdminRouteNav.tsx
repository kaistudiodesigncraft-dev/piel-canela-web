import { CalendarDays, ContactRound, FilePenLine, HandHeart, Settings, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";

type AdminRoute = "operations" | "catalog" | "professionals" | "customers" | "settings" | "content" | "governance";

const routes: readonly { id: AdminRoute; href: string; label: string; icon: typeof CalendarDays }[] = [
  { id: "operations", href: "/admin", label: "Operación", icon: CalendarDays },
  { id: "catalog", href: "/admin/catalogo", label: "Catálogo", icon: HandHeart },
  { id: "professionals", href: "/admin/profesionales", label: "Profesionales", icon: UsersRound },
  { id: "customers", href: "/admin/clientes", label: "Clientes", icon: ContactRound },
  { id: "settings", href: "/admin/configuracion", label: "Configuración", icon: Settings },
  { id: "content", href: "/admin/contenido", label: "Contenido", icon: FilePenLine },
  { id: "governance", href: "/admin/seguridad", label: "Accesos y actividad", icon: ShieldCheck },
];

export function AdminRouteNav({ current, canManageAccess = false }: { current: AdminRoute; canManageAccess?: boolean }) {
  return (
    <nav className="admin-route-nav" aria-label="Navegación administrativa">
      {routes.filter((route) => !["content", "governance"].includes(route.id) || canManageAccess).map((route) => {
        const Icon = route.icon;
        return (
          <Link
            key={route.id}
            href={route.href}
            aria-current={current === route.id ? "page" : undefined}
          >
            <Icon aria-hidden="true" strokeWidth={1.75} />
            {route.label}
          </Link>
        );
      })}
    </nav>
  );
}
