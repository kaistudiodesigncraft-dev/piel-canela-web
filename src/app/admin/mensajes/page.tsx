import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { MESSAGE_EVENTS, type MessageTemplates } from "@/domain/whatsapp";
import { DEFAULT_MESSAGE_TEMPLATES } from "@/lib/whatsapp/templates";
import { MessageEditor } from "./MessageEditor";
import { RetryMessage } from "./RetryMessage";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ treatmentId?: string }> }) {
  const { supabase, profile } = await requireAdmin();
  const { treatmentId } = await searchParams;
  const treatments = await supabase.from("treatments").select("id,name").order("name");
  const selected = treatments.data?.find((row) => row.id === treatmentId);
  const templates = selected ? await supabase.from("treatment_message_templates").select("event,body").eq("treatment_id", selected.id) : null;
  const overrides = Object.fromEntries((templates?.data ?? []).map((row) => [row.event, row.body])) as MessageTemplates;
  const history = await supabase.from("whatsapp_outbox").select("id,booking_id,event,state,attempts,updated_at").order("updated_at", { ascending: false }).limit(30);
  return <div className="live-admin site-container"><header><h1>Mensajes por tratamiento</h1><p>Prepará mensajes para abrir en WhatsApp. Guardarlos no envía mensajes ni modifica las plantillas aprobadas de Meta.</p></header>
    <AdminRouteNav current="messages" canManageAccess={profile.role === "admin"} />
    <form><label htmlFor="message-treatment">Tratamiento</label><select id="message-treatment" name="treatmentId" defaultValue={selected?.id ?? ""} required><option value="">Seleccionar</option>{treatments.data?.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><button className="button" type="submit">Abrir mensajes</button></form>
    {(treatments.error || templates?.error) && <p role="alert">No se pudieron cargar los mensajes. No guardes cambios hasta reintentar la consulta.</p>}
    {selected && !templates?.error && MESSAGE_EVENTS.map((event) => <MessageEditor key={`${selected.id}-${event}`} treatmentId={selected.id} event={event} label={{ pre_reservation: "Pre-reserva", confirmation: "Confirmación", preparation: "Indicaciones previas" }[event]} initialBody={overrides[event] ?? DEFAULT_MESSAGE_TEMPLATES[event]} />)}
    <section><h2>Comunicación automática reciente</h2><p>Últimos 30 eventos. Los estados de entrega no modifican la reserva. Un resultado incierto requiere revisión de Kai Studio antes de reenviar.</p>
      {history.error ? <p role="status">El historial todavía no está disponible. Los mensajes manuales se pueden editar de forma independiente.</p> : history.data?.length ? <ul>{history.data.map((item) => <li key={item.id}><p>Reserva {item.booking_id.slice(0, 8)} · {item.event} · {item.state} · {item.attempts} intentos</p>{item.state === "failed" && item.attempts < 3 && <RetryMessage id={item.id} />}</li>)}</ul> : <p>No hay envíos registrados.</p>}
    </section>
    <p>El envío automático requiere número, consentimiento y plantillas del proveedor validados.</p><Link href="/admin/catalogo">Volver a tratamientos</Link>
  </div>;
}
