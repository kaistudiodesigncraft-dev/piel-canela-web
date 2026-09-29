"use client";

import { ChevronDown, History, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { restoreAuditRecord } from "@/app/admin/historial/actions";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_TABLE_LABELS,
  auditEntityReference,
  auditFieldComparisons,
  auditSearchText,
  type AuditAction,
  type OperationalAuditRecord,
} from "@/lib/admin/audit";

interface AdminProfile {
  user_id: string;
  full_name: string;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(value));
}

function profileName(profiles: AdminProfile[], actorId: string | null) {
  if (!actorId) return "Sistema";
  return profiles.find((profile) => profile.user_id === actorId)?.full_name ?? "Cuenta administrativa";
}

function restoreErrorMessage(error: string | undefined) {
  if (error === "invalid") return "Completá un motivo para restaurar esta versión.";
  if (error === "notRestorable") return "Ese evento no tiene una versión anterior restaurable.";
  if (error === "conflict") return "No se pudo restaurar porque ya existe un registro con la misma identidad o URL.";
  if (error === "permission") return "Tu cuenta no tiene permiso para restaurar este evento.";
  if (error) return "No pudimos restaurar la versión. Revisá el evento o contactá a soporte.";
  return null;
}

function canRestore(event: OperationalAuditRecord) {
  return event.is_restorable;
}

export function AdminHistory({
  events,
  profiles,
  feedback,
}: {
  events: OperationalAuditRecord[];
  profiles: AdminProfile[];
  feedback: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState<"all" | AuditAction>("all");
  const normalizedQuery = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filteredEvents = useMemo(() => events.filter((event) => {
    if (entity !== "all" && event.table_name !== entity) return false;
    if (action !== "all" && event.action !== action) return false;
    return !normalizedQuery || auditSearchText(event, profileName(profiles, event.actor_id)).includes(normalizedQuery);
  }), [action, entity, events, normalizedQuery, profiles]);
  const error = restoreErrorMessage(feedback.restoreError);

  return (
    <section className="live-admin__section admin-governance" id="historial" aria-labelledby="history-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="history-title">Historial recuperable</h2>
          <p>Revisá ediciones o eliminaciones de tratamientos y profesionales. Las restauraciones quedan registradas como nuevos eventos.</p>
        </div>
        <span className="admin-count numeric">{filteredEvents.length} eventos</span>
      </div>
      {feedback.restored === "1" ? <p className="form-message" role="status">Versión restaurada y registrada en el historial.</p> : null}
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      <div className="admin-booking-toolbar">
        <label className="admin-search">
          <Search aria-hidden="true" strokeWidth={1.75} />
          <span className="sr-only">Buscar historial</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tratamiento, profesional o responsable" />
        </label>
        <label>
          <span className="sr-only">Filtrar entidad</span>
          <select value={entity} onChange={(event) => setEntity(event.target.value)}>
            <option value="all">Tratamientos y profesionales</option>
            <option value="treatments">Tratamientos</option>
            <option value="professionals">Profesionales</option>
            <option value="professional_specialties">Especialidades asignadas</option>
            <option value="treatment_professionals">Profesionales asignados</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar acción</span>
          <select value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
            <option value="all">Todas las acciones</option>
            <option value="insert">Creaciones</option>
            <option value="update">Ediciones</option>
            <option value="delete">Eliminaciones</option>
          </select>
        </label>
      </div>
      {filteredEvents.length === 0 ? (
        <div className="admin-empty"><History aria-hidden="true" strokeWidth={1.75} /><h3>No hay eventos para este filtro.</h3><p>Probá buscar con otro nombre o volvé a mostrar todas las acciones.</p></div>
      ) : (
        <div className="admin-activity-list">
          {filteredEvents.map((event) => {
            const actor = profileName(profiles, event.actor_id);
            const fields = auditFieldComparisons(event);
            const reference = auditEntityReference(event);
            const restorable = canRestore(event);
            return (
              <details className="admin-activity-item" key={event.id}>
                <summary>
                  <span className="admin-activity-item__icon" aria-hidden="true"><History strokeWidth={1.75} /></span>
                  <span><strong>{AUDIT_ACTION_LABELS[event.action]} en {AUDIT_TABLE_LABELS[event.table_name] ?? event.table_name}</strong><small>{actor}{reference ? ` · ${reference}` : ""}</small></span>
                  <time dateTime={event.created_at}>{dateLabel(event.created_at)}</time>
                  <ChevronDown aria-hidden="true" strokeWidth={1.75} />
                </summary>
                <div className="admin-activity-item__body">
                  {fields.length === 0 ? <p>El evento no contiene campos públicos para mostrar.</p> : (
                    <ul>{fields.map((field) => <li key={field.key}><strong>{field.label}</strong><span>{field.hasValues ? `${field.before} → ${field.after}` : field.after}</span></li>)}</ul>
                  )}
                  <small>Identificador: {event.record_id ?? "sin referencia"}</small>
                  {restorable ? (
                    <form action={restoreAuditRecord} className="admin-form admin-form--booking-action">
                      <input type="hidden" name="auditId" value={event.id} />
                      <div><RotateCcw aria-hidden="true" strokeWidth={1.75} /><h4>Restaurar versión anterior</h4></div>
                      <label>Motivo de restauración<textarea name="reason" minLength={3} maxLength={500} required placeholder="Ej.: edición realizada por error durante la carga" /></label>
                      <AdminSubmitButton className="button button--quiet" pendingLabel="Restaurando…">Restaurar esta versión</AdminSubmitButton>
                    </form>
                  ) : (
                    <p className="admin-field-note"><ShieldAlert aria-hidden="true" strokeWidth={1.75} />Este evento queda como consulta. Para revertirlo, usá el editor correspondiente o pedí soporte si involucra relaciones.</p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
