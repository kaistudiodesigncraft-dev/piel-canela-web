"use client";
import { useActionState, useState } from "react";
import { MESSAGE_VARIABLES, type MessageEvent } from "@/domain/whatsapp";
import { resolveWhatsAppMessage } from "@/lib/whatsapp/templates";
import { saveMessageTemplate } from "./actions";

export function MessageEditor({ treatmentId, event, initialBody, label }: { treatmentId: string; event: MessageEvent; initialBody: string; label: string }) {
  const [body, setBody] = useState(initialBody);
  const [state, action, pending] = useActionState(saveMessageTemplate, {});
  const preview = resolveWhatsAppMessage(event, { [event]: body }, { nombre: "Persona de muestra", tratamiento: "Tratamiento de muestra", combo: "Sin combo", fecha: "20 de septiembre", hora: "15:00", duracion: "60 minutos", codigo: "PC-EJEMPLO", direccion: "Dirección de muestra", sena: "Seña pendiente de confirmación" });
  return <form action={action} className="admin-form">
    <input type="hidden" name="treatmentId" value={treatmentId} /><input type="hidden" name="event" value={event} />
    <h2>{label}</h2><label htmlFor={`message-${event}`}>Texto del mensaje</label>
    <textarea id={`message-${event}`} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} minLength={10} maxLength={1800} required aria-describedby={`help-${event}`} />
    <p id={`help-${event}`}>Variables: {MESSAGE_VARIABLES.map((key) => `{{${key}}}`).join(", ")}. No incluyas datos de salud ni notas internas.</p>
    <details><summary>Previsualizar con datos de muestra</summary><p style={{ whiteSpace: "pre-wrap" }}>{preview}</p></details>
    <p role="status">{state.error ?? (state.saved ? "Mensaje guardado." : "")}</p>
    <button className="button" disabled={pending}>{pending ? "Guardando…" : "Guardar mensaje"}</button>
  </form>;
}
