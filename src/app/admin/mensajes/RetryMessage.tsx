"use client";
import { useActionState } from "react";
import { retryMessage } from "./actions";
export function RetryMessage({ id }: { id: string }) {
  const [state, action, pending] = useActionState(retryMessage, {});
  return <form action={action}><input type="hidden" name="id" value={id} /><label htmlFor={`retry-${id}`}>Motivo del reintento</label><input id={`retry-${id}`} name="reason" minLength={5} maxLength={240} required /><button className="button button--quiet" disabled={pending || state.saved}>{pending ? "Procesando…" : "Volver a poner en cola"}</button><p role="status">{state.error ?? (state.saved ? "Pendiente de envío. Requiere canal automático habilitado." : "")}</p></form>;
}
