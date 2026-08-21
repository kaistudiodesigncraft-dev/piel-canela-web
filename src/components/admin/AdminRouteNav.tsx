import { CalendarDays, FilePenLine, HandHeart, UsersRound } from "lucide-react";
import Link from "next/link";

type AdminRoute = "operations" | "catalog" | "professionals" | "content";

const routes: readonly { id: AdminRoute; href: string; label: string; icon: typeof CalendarDays }[] = [
  { id: "operations", href: "/admin", label: "Operación", icon: CalendarDays },
  { id: "catalog", href: "/admin/catalogo", label: "Catálogo", icon: HandHeart },
  { id: "professionals", href: "/admin/profesionales", label: "Profesionales", icon: UsersRound },
  { id: "content", href: "/admin/contenido", label: "Contenido", icon: FilePenLine },
];

export function AdminRouteNav({ current }: { current: AdminRoute }) {
  return (
    <nav className="admin-route-nav" aria-label="Navegación administrativa">
      {routes.map((route) => {
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

