"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminRouteLoading({ title }: { title: string }) {
  return (
    <div className="live-admin site-container" aria-busy="true" aria-label={`Cargando ${title}`}>
      <div className="admin-route-loading"><span /><span /><span /></div>
    </div>
  );
}

export function AdminRouteError({ reset, title, incidentId }: { reset: () => void; title: string; incidentId?: string }) {
  return (
    <section className="admin-route-error site-container" aria-labelledby="admin-route-error-title" role="alert">
      <AlertCircle aria-hidden="true" strokeWidth={1.75} />
      <h1 id="admin-route-error-title">No pudimos cargar {title}.</h1>
      <p>La sesión sigue protegida. Reintentá la consulta o volvé a la operación general.</p>
      {incidentId ? <p className="admin-incident-reference">Código de soporte: <code>{incidentId}</code></p> : null}
      <div className="button-row"><button className="button button--primary" type="button" onClick={reset}><RotateCcw aria-hidden="true" strokeWidth={1.75} />Reintentar</button><Link className="button button--quiet" href="/admin">Volver al panel</Link></div>
    </section>
  );
}

export function AdminInlineDataError({
  title,
  description,
  incidentId,
}: {
  title: string;
  description: string;
  incidentId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section className="admin-route-error admin-route-error--inline" aria-labelledby="admin-inline-error-title" role="alert">
      <AlertCircle aria-hidden="true" strokeWidth={1.75} />
      <h2 id="admin-inline-error-title" ref={titleRef} tabIndex={-1}>{title}</h2>
      <p>{description}</p>
      <p className="admin-incident-reference">Código de soporte: <code>{incidentId}</code></p>
      <button
        className="button button--primary"
        type="button"
        disabled={isPending}
        aria-disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RotateCcw aria-hidden="true" strokeWidth={1.75} />
        {isPending ? "Reintentando…" : "Reintentar carga"}
      </button>
    </section>
  );
}
