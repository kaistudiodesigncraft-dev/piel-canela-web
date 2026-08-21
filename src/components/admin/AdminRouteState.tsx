"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";

export function AdminRouteLoading({ title }: { title: string }) {
  return (
    <div className="live-admin site-container" aria-busy="true" aria-label={`Cargando ${title}`}>
      <div className="admin-route-loading"><span /><span /><span /></div>
    </div>
  );
}

export function AdminRouteError({ reset, title }: { reset: () => void; title: string }) {
  return (
    <section className="admin-route-error site-container" aria-labelledby="admin-route-error-title">
      <AlertCircle aria-hidden="true" strokeWidth={1.75} />
      <h1 id="admin-route-error-title">No pudimos cargar {title}.</h1>
      <p>La sesión sigue protegida. Reintentá la consulta o volvé a la operación general.</p>
      <div className="button-row"><button className="button button--primary" type="button" onClick={reset}><RotateCcw aria-hidden="true" strokeWidth={1.75} />Reintentar</button><Link className="button button--quiet" href="/admin">Volver al panel</Link></div>
    </section>
  );
}

