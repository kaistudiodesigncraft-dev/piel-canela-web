"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { saveProfessional } from "@/app/admin/profesionales/actions";
import { preserveSubmittedForm } from "@/lib/admin/preserve-form";

export function ProfessionalSaveForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState(saveProfessional, {});
  const dirty = useRef(false);
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) error.current?.focus();
  }, [state]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const protectNavigation = (event: MouseEvent) => {
      if (!dirty.current || event.defaultPrevented || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      const destination = new URL(link.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!window.confirm("Hay cambios sin guardar en el perfil. ¿Querés salir y descartarlos?")) {
        event.preventDefault(); event.stopPropagation();
      } else { dirty.current = false; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", protectNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", protectNavigation, true);
    };
  }, []);
  return <form action={action} onSubmit={(event) => preserveSubmittedForm(event.currentTarget)} className="admin-form admin-form--professional" onChange={() => { dirty.current = true; }} aria-busy={pending}>
    {state.error ? <p ref={error} tabIndex={-1} className="form-message form-message--error" role="alert">{state.error}</p> : null}
    {children}
    <button className="button button--primary" disabled={pending} type="submit">{pending ? "Guardando perfil…" : "Guardar profesional"}</button>
  </form>;
}
