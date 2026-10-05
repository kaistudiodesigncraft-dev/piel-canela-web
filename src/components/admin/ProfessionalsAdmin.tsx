import { ProfessionalNameFields } from "./ProfessionalNameFields";
import { ChevronDown, Plus, Trash2, UserRound } from "lucide-react";
import { deleteProfessional } from "@/app/admin/profesionales/actions";
import { ProfessionalSaveForm } from "./ProfessionalSaveForm";
import { randomUUID } from "node:crypto";

interface SpecialtyRow {
  id: string;
  name: string;
  is_active: boolean;
}

interface ProfessionalRow {
  id: string;
  specialty_id: string;
  specialty_ids: string[];
  full_name: string;
  public_name: string | null;
  phone: string | null;
  bio: string | null;
  internal_notes: string | null;
  is_active: boolean;
  display_order: number;
  assigned_treatment_count: number;
  booking_count: number;
  updated_at?: string;
  usage_available?: boolean;
}

function feedbackMessage(error?: string) {
  const messages: Record<string, string> = {
    duplicate: "Ya existe una persona con ese nombre dentro de la especialidad.",
    assigned: "No se puede cambiar la especialidad mientras tenga tratamientos asignados.",
    impact: "La persona tiene tratamientos asignados. Confirmá el impacto antes de desactivarla.",
    specialty: "La especialidad seleccionada no está activa.",
    deleteConfirmation: "Confirmá la eliminación y completá el código de seguridad.",
    deleteCode: "El código de eliminación no es correcto.",
    deleteLinked: "Este profesional tiene tratamientos asignados o turnos registrados. Para conservar el historial, desactivalo en lugar de eliminarlo.",
    deleteNotConfigured: "La eliminación protegida no está configurada. Contactá a Kai Studio.",
    deleteRateLimited: "Se alcanzó el límite de intentos. Esperá antes de volver a probar.",
    deleteFailed: "No pudimos eliminar el profesional. No se modificó ningún dato.",
  };
  return messages[error ?? ""] ?? "No se pudieron guardar los cambios. Revisá los campos e intentá nuevamente.";
}

export function ProfessionalsAdmin({ specialties, professionals, feedback }: { specialties: SpecialtyRow[]; professionals: ProfessionalRow[]; feedback: Record<string, string | undefined> }) {
  const specialtyName = new Map(specialties.map((item) => [item.id, item.name]));
  return (
    <section className="live-admin__section" id="equipo" aria-labelledby="professionals-title">
      <div className="admin-section-heading"><div><h2 id="professionals-title">Equipo profesional</h2><p>Usá un único perfil por persona y asignale todas sus especialidades. Los horarios de la especialidad habilitan turnos; la agenda del profesional evita superposiciones.</p></div><span className="admin-count numeric">{professionals.length} perfiles</span></div>
      {feedback.professionalSaved === "1" ? <p className="form-message" role="status">Perfil profesional guardado.</p> : null}
      {feedback.professionalDeleted === "1" ? <p className="form-message" role="status">Perfil profesional eliminado.</p> : null}
      {feedback.professionalError ? <p className="form-message form-message--error" role="alert">{feedbackMessage(feedback.professionalError)}</p> : null}
      <details className="admin-disclosure admin-create-disclosure"><summary><span><Plus aria-hidden="true" strokeWidth={1.75} />Agregar profesional</span><ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary><ProfessionalForm specialties={specialties} existingNames={professionals.flatMap((person) => [person.full_name, person.public_name ?? ""])} /></details>
      {professionals.length === 0 ? <div className="admin-empty"><UserRound aria-hidden="true" strokeWidth={1.75} /><h3>Todavía no hay profesionales.</h3><p>Creá el primer perfil para poder asignarlo a tratamientos.</p></div> : (
        <div className="admin-professional-list">
          {professionals.map((professional) => (
            <details className="admin-professional-item" key={professional.id}>
              <summary>
                <span className="admin-professional-avatar" aria-hidden="true">{(professional.public_name || professional.full_name).slice(0, 1).toLocaleUpperCase("es-AR")}</span>
                <span><strong>{professional.public_name || professional.full_name}</strong><small>{(professional.specialty_ids ?? [professional.specialty_id]).map((id) => specialtyName.get(id)).filter(Boolean).join(" · ")} · {professional.assigned_treatment_count} tratamientos</small></span>
                <span className={`status-badge ${professional.is_active ? "status-confirmed" : "status-expired"}`}>{professional.is_active ? "Activo" : "Inactivo"}</span>
                <ChevronDown aria-hidden="true" strokeWidth={1.75} />
              </summary>
              <ProfessionalForm specialties={specialties} professional={professional} />
              <DeleteProfessionalForm professional={professional} />
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function DeleteProfessionalForm({ professional }: { professional: ProfessionalRow }) {
  const isLinked = professional.usage_available === false || professional.assigned_treatment_count > 0 || professional.booking_count > 0;
  return (
    <details className="admin-delete-treatment admin-delete-professional">
      <summary><span><Trash2 aria-hidden="true" strokeWidth={1.75} />Eliminar profesional</span></summary>
      <div className="admin-delete-treatment__form">
        {isLinked ? (
          <div>
            <strong>No se puede eliminar este perfil.</strong>
            <p>{professional.usage_available === false ? "No se pudieron verificar sus vinculaciones. Recargá la página para reintentar; no eliminaremos el perfil sin esa comprobación." : <>Tiene {professional.assigned_treatment_count} tratamientos asignados y {professional.booking_count} turnos registrados. Desactivalo para impedir nuevas reservas sin perder el historial.</>}</p>
          </div>
        ) : (
          <form action={deleteProfessional} className="admin-professional-delete-form">
            <input type="hidden" name="professionalId" value={professional.id} />
            <div><strong>Esta acción elimina el perfil.</strong><p>Solo está disponible porque no tiene tratamientos ni turnos vinculados. La operación quedará registrada en Historial.</p></div>
            <label htmlFor={`professional-delete-code-${professional.id}`}>Código de eliminación<input id={`professional-delete-code-${professional.id}`} name="confirmationCode" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={128} autoComplete="off" required /></label>
            <label className="admin-check" htmlFor={`professional-delete-confirm-${professional.id}`}><input id={`professional-delete-confirm-${professional.id}`} name="confirmDeletion" type="checkbox" required /><span>Confirmo que quiero eliminar “{professional.public_name || professional.full_name}”.</span></label>
            <button className="button button--danger" type="submit"><Trash2 aria-hidden="true" strokeWidth={1.75} />Eliminar definitivamente</button>
          </form>
        )}
      </div>
    </details>
  );
}

function ProfessionalForm({ specialties, professional, existingNames = [] }: { specialties: SpecialtyRow[]; professional?: ProfessionalRow; existingNames?: string[] }) {
  return (
    <ProfessionalSaveForm>
      <input type="hidden" name="professionalId" value={professional?.id ?? randomUUID()} />
      <input type="hidden" name="expectedUpdatedAt" value={professional?.updated_at ?? ""} />
      <div className="admin-form-grid admin-form-grid--3"><ProfessionalNameFields fullName={professional?.full_name} publicName={professional?.public_name ?? ""} existingNames={existingNames} /><label>Teléfono interno opcional<input name="phone" defaultValue={professional?.phone ?? ""} maxLength={40} /></label></div>
      <label>Especialidad principal<select name="specialtyId" defaultValue={professional?.specialty_id ?? ""} required><option value="">Seleccionar</option>{specialties.filter((item) => item.is_active || item.id === professional?.specialty_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <fieldset className="depilation-zone-picker"><legend>También puede atender</legend>{specialties.filter((item) => item.is_active || professional?.specialty_ids?.includes(item.id)).map((item) => <label className="admin-check" key={item.id}><input type="checkbox" name="specialtyIds" value={item.id} defaultChecked={professional?.specialty_ids?.includes(item.id) ?? false} /><span>{item.name}</span></label>)}</fieldset>
      <label>Presentación opcional<textarea name="bio" defaultValue={professional?.bio ?? ""} rows={4} maxLength={1400} /></label>
      <label>Notas internas<textarea name="internalNotes" defaultValue={professional?.internal_notes ?? ""} rows={3} maxLength={1400} /></label>
      <div className="admin-form-grid"><label>Orden<input name="displayOrder" type="number" min="0" max="999" defaultValue={professional?.display_order ?? 0} required /></label><label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={professional?.is_active ?? true} /><span>Disponible para asignar y mostrar</span></label></div>
      {professional ? <label className="admin-impact-check"><input type="checkbox" name="confirmImpact" /><span>Confirmo que, si lo desactivo, no recibirá nuevas reservas. Los turnos existentes se conservan y deben revisarse.</span></label> : null}
      <p>El nombre interno organiza el panel; el nombre público es el que verá la persona.</p>
    </ProfessionalSaveForm>
  );
}
