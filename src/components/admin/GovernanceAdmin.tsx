"use client";

import { ChevronDown, History, Search, ShieldCheck, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { updateAdminProfile } from "@/app/admin/seguridad/actions";
import { ManagerActivationPanel } from "./ManagerActivationPanel";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_TABLE_LABELS,
  auditChangedFields,
  auditEntityReference,
  auditSearchText,
  type AuditRecord,
} from "@/lib/admin/audit";

export interface AdminProfileRow {
  user_id: string;
  full_name: string;
  role: "admin" | "manager";
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

function profileName(profiles: AdminProfileRow[], actorId: string | null) {
  if (!actorId) return "Sistema";
  return profiles.find((profile) => profile.user_id === actorId)?.full_name ?? "Cuenta administrativa";
}

export function GovernanceAdmin({
  currentUserId,
  profiles,
  events,
  feedback,
}: {
  currentUserId: string;
  profiles: AdminProfileRow[];
  events: AuditRecord[];
  feedback: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<"all" | AuditRecord["action"]>("all");
  const normalizedQuery = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filteredEvents = useMemo(() => events.filter((event) => {
    if (action !== "all" && event.action !== action) return false;
    return !normalizedQuery || auditSearchText(event, profileName(profiles, event.actor_id)).includes(normalizedQuery);
  }), [action, events, normalizedQuery, profiles]);

  const errorMessage = feedback.profileError === "self"
    ? "No podés desactivar la cuenta que estás usando."
    : feedback.profileError === "last"
      ? "Debe quedar al menos una cuenta administrativa activa."
      : feedback.profileError
        ? "No pudimos guardar el acceso. Revisá los datos e intentá de nuevo."
        : null;

  return (
    <>
      <section className="live-admin__section admin-governance" id="accesos" aria-labelledby="access-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="access-title">Accesos administrativos</h2>
            <p>Habilitá o revocá el ingreso de cuentas ya verificadas. La creación de nuevas cuentas se mantiene controlada por Kai Studio.</p>
          </div>
          <span className="admin-count numeric">{profiles.filter((profile) => profile.is_active).length} activos</span>
        </div>
        {feedback.profileSaved === "1" ? <p className="form-message" role="status">Acceso actualizado y registrado en la actividad.</p> : null}
        {errorMessage ? <p className="form-message form-message--error" role="alert">{errorMessage}</p> : null}
        <div className="admin-access-list">
          {profiles.map((profile) => {
            const isCurrent = profile.user_id === currentUserId;
            return (
              <form action={updateAdminProfile} className="admin-access-row" key={profile.user_id}>
                <input type="hidden" name="userId" value={profile.user_id} />
                <span className="admin-professional-avatar" aria-hidden="true">{profile.full_name.slice(0, 1).toUpperCase()}</span>
                <label>
                  <span>Nombre visible</span>
                  <input name="fullName" minLength={2} maxLength={100} defaultValue={profile.full_name} required />
                </label>
                <label className="admin-access-row__role"><span>Permiso</span><select name="role" defaultValue={profile.role} disabled={isCurrent}><option value="admin">Propietario técnico</option><option value="manager">Gestión del cliente</option></select>{isCurrent ? <input type="hidden" name="role" value="admin" /> : null}</label>
                <label>
                  <span>Estado</span>
                  <select name="isActive" defaultValue={profile.is_active ? "true" : "false"} disabled={isCurrent}>
                    <option value="true">Activo</option>
                    <option value="false">Revocado</option>
                  </select>
                  {isCurrent ? <input type="hidden" name="isActive" value="true" /> : null}
                </label>
                <span className={`status-badge ${profile.is_active ? "status-confirmed" : "status-cancelled"}`}>
                  {isCurrent ? "Sesión actual" : profile.is_active ? "Activo" : "Revocado"}
                </span>
                <button className="button button--quiet" type="submit">Guardar acceso</button>
              </form>
            );
          })}
        </div>
        <p className="admin-access-note"><ShieldCheck aria-hidden="true" strokeWidth={1.75} />Gestión del cliente opera agenda, catálogo, profesionales, clientes y configuración. Solo un propietario técnico puede editar contenido institucional, administrar accesos y consultar la actividad completa.</p>
      </section>

      <ManagerActivationPanel />

      <section className="live-admin__section admin-governance" id="actividad" aria-labelledby="activity-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="activity-title">Actividad administrativa</h2>
            <p>Consultá quién cambió reservas, catálogo, agenda, contenido o configuración. Los datos privados permanecen ocultos.</p>
          </div>
          <span className="admin-count numeric">{filteredEvents.length} eventos</span>
        </div>
        <div className="admin-booking-toolbar">
          <label className="admin-search"><Search aria-hidden="true" strokeWidth={1.75} /><span className="sr-only">Buscar actividad</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar persona, sección o referencia" /></label>
          <label><span className="sr-only">Filtrar por acción</span><select value={action} onChange={(event) => setAction(event.target.value as typeof action)}><option value="all">Todas las acciones</option><option value="insert">Creaciones</option><option value="update">Ediciones</option><option value="delete">Eliminaciones</option></select></label>
        </div>
        {filteredEvents.length === 0 ? (
          <div className="admin-empty"><History aria-hidden="true" strokeWidth={1.75} /><h3>No hay actividad para este filtro.</h3><p>Probá otra búsqueda o seleccioná todas las acciones.</p></div>
        ) : (
          <div className="admin-activity-list">
            {filteredEvents.map((event) => {
              const actor = profileName(profiles, event.actor_id);
              const fields = auditChangedFields(event);
              const reference = auditEntityReference(event);
              return (
                <details className="admin-activity-item" key={event.id}>
                  <summary>
                    <span className="admin-activity-item__icon" aria-hidden="true"><UserRound strokeWidth={1.75} /></span>
                    <span><strong>{AUDIT_ACTION_LABELS[event.action]} en {AUDIT_TABLE_LABELS[event.table_name] ?? event.table_name}</strong><small>{actor}{reference ? ` · ${reference}` : ""}</small></span>
                    <time dateTime={event.created_at}>{dateLabel(event.created_at)}</time>
                    <ChevronDown aria-hidden="true" strokeWidth={1.75} />
                  </summary>
                  <div className="admin-activity-item__body">
                    {fields.length === 0 ? <p>El evento no contiene campos públicos para mostrar.</p> : (
                      <ul>{fields.map((field) => <li key={field.key}><strong>{field.label}</strong><span>{field.isPrivate ? "Contenido protegido actualizado" : event.action === "insert" ? "Definido" : event.action === "delete" ? "Eliminado" : "Actualizado"}</span></li>)}</ul>
                    )}
                    <small>Identificador: {event.record_id ?? "sin referencia"}</small>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
