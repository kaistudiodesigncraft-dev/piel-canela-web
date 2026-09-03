"use client";

import { ArrowRight, CalendarDays, ContactRound, FilePenLine, HandHeart, Settings, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  const navRef = useRef<HTMLElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const updateHint = () => {
      const remaining = nav.scrollWidth - nav.clientWidth - nav.scrollLeft;
      setShowScrollHint(remaining > 8);
    };
    updateHint();
    nav.addEventListener("scroll", updateHint, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateHint);
    observer?.observe(nav);
    window.addEventListener("resize", updateHint);
    return () => {
      nav.removeEventListener("scroll", updateHint);
      window.removeEventListener("resize", updateHint);
      observer?.disconnect();
    };
  }, [canManageAccess]);

  return (
    <div className={`admin-route-nav-shell${showScrollHint ? " has-scroll-hint" : ""}`}>
      <nav className="admin-route-nav" aria-label="Navegación administrativa" ref={navRef}>
        {routes.filter((route) => route.id !== "governance" || canManageAccess).map((route) => {
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
      <span className="admin-route-nav__scroll-hint" aria-hidden="true">
        Deslizá <ArrowRight strokeWidth={1.75} />
      </span>
    </div>
  );
}
