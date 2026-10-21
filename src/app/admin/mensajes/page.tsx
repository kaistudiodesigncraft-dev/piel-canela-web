import Link from "next/link";
import { Clock3, MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/admin/require-admin";
import { MESSAGE_EVENTS, type MessageTemplates } from "@/domain/whatsapp";
import { DEFAULT_MESSAGE_TEMPLATES } from "@/lib/whatsapp/templates";
import { MessageEditor } from "./MessageEditor";
import { RetryMessage } from "./RetryMessage";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";

const eventLabels = {
  pre_reservation: "Pre-reserva",
  confirmation: "Confirmación",
  preparation: "Indicaciones previas",
} as const;

const stateLabels: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  sent: "Enviado",
  delivered: "Entregado",
  failed: "Falló",
  uncertain: "Requiere revisión",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(value));
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ treatmentId?: string }> }) {
  const { supabase, profile } = await requireAdmin();
  const { treatmentId } = await searchParams;
  const [treatments, history] = await Promise.all([
    supabase.from("treatments").select("id,name").order("name"),
    supabase.from("whatsapp_outbox").select("id,booking_id,event,state,attempts,updated_at").order("updated_at", { ascending: false }).limit(30),
  ]);
  const selected = treatments.data?.find((row) => row.id === treatmentId);
  const templates = selected ? await supabase.from("treatment_message_templates").select("event,body").eq("treatment_id", selected.id) : null;
  const overrides = Object.fromEntries((templates?.data ?? []).map((row) => [row.event, row.body])) as MessageTemplates;
  return <div className="live-admin site-container admin-messages-page"><header className="live-admin__header"><div><p className="eyebrow">Web y comunicación</p><h1>Mensajes por tratamiento</h1><p>Prepará los textos que recepción abre en WhatsApp. Guardar un mensaje no lo envía automáticamente.</p></div></header>
    <AdminRouteNav current="messages" canManageAccess={profile.role === "admin"} />
    <section className="live-admin__section" aria-labelledby="message-treatment-title">
      <div className="admin-section-heading"><div><h2 id="message-treatment-title">Elegí un tratamiento</h2><p>Cada tratamiento puede tener textos distintos para la pre-reserva, la confirmación y las indicaciones previas.</p></div><MessageCircle aria-hidden="true" strokeWidth={1.75} /></div>
      <form className="admin-form admin-message-selector"><label htmlFor="message-treatment">Tratamiento<select id="message-treatment" name="treatmentId" defaultValue={selected?.id ?? ""} required><option value="">Seleccionar</option>{treatments.data?.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button className="button button--primary" type="submit">Ver mensajes</button></form>
      {treatments.error ? <p className="form-message form-message--error" role="alert">No pudimos cargar los tratamientos. Reintentá antes de editar mensajes.</p> : null}
    </section>
    {selected && !templates?.error ? <section className="live-admin__section" aria-labelledby="message-editor-title"><div className="admin-section-heading"><div><h2 id="message-editor-title">Mensajes de {selected.name}</h2><p>Podés revisar y guardar cada momento por separado. La vista previa usa datos de muestra.</p></div><span className="admin-count">3 momentos</span></div><div className="admin-message-editor-grid">{MESSAGE_EVENTS.map((event) => <MessageEditor key={`${selected.id}-${event}`} treatmentId={selected.id} event={event} label={eventLabels[event]} initialBody={overrides[event] ?? DEFAULT_MESSAGE_TEMPLATES[event]} />)}</div></section> : null}
    {templates?.error ? <p className="form-message form-message--error" role="alert">No pudimos cargar los mensajes de este tratamiento. El contenido existente no fue modificado.</p> : null}
    <section className="live-admin__section" aria-labelledby="message-history-title"><div className="admin-section-heading"><div><h2 id="message-history-title">Actividad reciente</h2><p>Últimos 30 eventos. Los estados de entrega no modifican la reserva.</p></div><Clock3 aria-hidden="true" strokeWidth={1.75} /></div>
      {history.error ? <p className="form-message form-message--warning" role="status">El historial no está disponible ahora. Los mensajes por tratamiento se pueden editar de forma independiente.</p> : history.data?.length ? <ul className="admin-message-history">{history.data.map((item) => <li key={item.id}><div><strong>Reserva {item.booking_id.slice(0, 8)}</strong><span>{eventLabels[item.event as keyof typeof eventLabels] ?? item.event} · {stateLabels[item.state] ?? item.state}</span><small><time dateTime={item.updated_at}>{dateLabel(item.updated_at)}</time> · {item.attempts} {item.attempts === 1 ? "intento" : "intentos"}</small></div>{item.state === "failed" && item.attempts < 3 ? <RetryMessage id={item.id} /> : null}</li>)}</ul> : <div className="admin-message-empty"><MessageCircle aria-hidden="true" strokeWidth={1.75} /><div><h3>No hay actividad registrada</h3><p>Los mensajes guardados quedan disponibles para usarlos desde cada reserva.</p></div></div>}
    </section>
    <footer className="admin-message-footer"><p>El envío automático requiere un canal habilitado. Mientras tanto, el panel prepara el texto para abrirlo en WhatsApp.</p><Link className="text-link" href="/admin/catalogo">Volver a tratamientos</Link></footer>
  </div>;
}
