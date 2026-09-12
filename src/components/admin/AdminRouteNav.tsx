"use client";
import { CalendarDays, ContactRound, FilePenLine, HandHeart, PackageCheck, Settings, ShieldCheck, UsersRound, PanelLeftClose, PanelLeftOpen, Menu, X, Clock3, Sparkles, UserRound, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./AdminShell.module.css";

type AdminRoute = "operations" | "agenda" | "availability" | "specials" | "catalog" | "packages" | "professionals" | "customers" | "settings" | "content" | "governance" | "account" | "messages";
const routes: readonly { id: AdminRoute; href: string; label: string; icon: typeof CalendarDays }[] = [
  { id: "operations", href: "/admin?module=today", label: "Hoy", icon: CalendarDays },
  { id: "agenda", href: "/admin?module=agenda", label: "Agenda", icon: CalendarDays },
  { id: "packages", href: "/admin/paquetes", label: "Paquetes", icon: PackageCheck },
  { id: "catalog", href: "/admin/catalogo", label: "Tratamientos", icon: HandHeart },
  { id: "specials", href: "/admin?module=specials", label: "Especiales del mes", icon: Sparkles },
  { id: "professionals", href: "/admin/profesionales", label: "Profesionales", icon: UsersRound },
  { id: "customers", href: "/admin/clientes", label: "Clientes", icon: ContactRound },
  { id: "availability", href: "/admin?module=availability", label: "Disponibilidad", icon: Clock3 },
  { id: "content", href: "/admin/contenido", label: "Contenido", icon: FilePenLine },
  { id: "messages", href: "/admin/mensajes", label: "Mensajes", icon: MessageCircle },
  { id: "settings", href: "/admin/configuracion", label: "Configuración", icon: Settings },
  { id: "account", href: "/admin/mi-cuenta", label: "Mi cuenta", icon: UserRound },
  { id: "governance", href: "/admin/seguridad", label: "Accesos y actividad", icon: ShieldCheck },
];
export function AdminRouteNav({ current, canManageAccess = false }: { current: AdminRoute; canManageAccess?: boolean }) {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    const returnFocus = trigger.current;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const media = window.matchMedia("(min-width: 1100px)");
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => { node?.close(); document.body.style.overflow = overflow; media.removeEventListener("change", closeOnDesktop); returnFocus?.focus(); };
  }, [open]);
  const navigation = (mobile = false) => <nav aria-label="Navegación administrativa" className={styles.links}>
    {routes.filter((route) => route.id !== "governance" || canManageAccess).map((route) => {
      const Icon = route.icon;
      return <Link key={route.id} href={route.href} aria-current={route.id === current ? "page" : undefined} title={compact && !mobile ? route.label : undefined} aria-label={route.label} onClick={() => setOpen(false)}><Icon aria-hidden="true" strokeWidth={1.75} /><span>{route.label}</span></Link>;
    })}
  </nav>;
  return <>
    <aside className={`${styles.sidebar} ${compact ? styles.compact : ""}`} data-admin-sidebar="true">
      <Link className={styles.brand} href="/admin?module=today" aria-label="Piel Canela, inicio del panel"><span>PC</span><strong>Piel Canela<small>Recepción</small></strong></Link>
      <button className={styles.collapse} type="button" aria-label={compact ? "Expandir menú" : "Contraer menú"} aria-expanded={!compact} onClick={() => setCompact(!compact)}>{compact ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}</button>
      {navigation()}<Link className={styles.publicLink} href="/" target="_blank" rel="noreferrer">Ver web pública</Link>
    </aside>
    <button className={styles.mobileTrigger} type="button" ref={trigger} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Menu aria-hidden="true" />Menú del panel</button>
    {open ? createPortal(<dialog ref={dialog} className={styles.drawer} aria-labelledby="admin-menu-title" onCancel={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div className={styles.drawerHeading}><strong id="admin-menu-title">Piel Canela</strong><button type="button" autoFocus aria-label="Cerrar menú" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></div>{navigation(true)}</dialog>, document.body) : null}
  </>;
}
