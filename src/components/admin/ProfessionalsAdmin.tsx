import { ChevronDown, Plus, UserRound } from "lucide-react";
import { saveProfessional } from "@/app/admin/profesionales/actions";

interface SpecialtyRow {
  id: string;
  name: string;
  is_active: boolean;
}

interface ProfessionalRow {
  id: string;
  specialty_id: string;
  full_name: string;
  public_name: string | null;
  bio: string | null;
  is_active: boolean;
  display_order: number;
  assigned_treatment_count: number;
}

function feedbackMessage(error?: string) {
  const messages: Record<string, string> = {
    duplicate: "Ya existe una persona con ese nombre dentro de la especialidad.",
    assigned: "No se puede cambiar la especialidad mientras tenga tratamientos asignados.",
    impact: "La persona tiene tratamientos asignados. Confirmá el impacto antes de desactivarla.",
    specialty: "La especialidad seleccionada no está activa.",
  };
  return messages[error ?? ""] ?? "No se pudieron guardar los cambios. Revisá los campos e intentá nuevamente.";
}

export function ProfessionalsAdmin({ specialties, professionals, feedback }: { specialties: SpecialtyRow[]; professionals: ProfessionalRow[]; feedback: Record<string, string | undefined> }) {
  const specialtyName = new Map(specialties.map((item) => [item.id, item.name]));
  return (
    <section className="live-admin__section" id="equipo" aria-labelledby="professionals-title">
      <div className="admin-section-heading"><div><h2 id="professionals-title">Equipo profesional</h2><p>Creá perfiles reutilizables y asignales una especialidad. La disponibilidad continúa controlada por especialidad.</p></div><span className="admin-count numeric">{professionals.length} perfiles</span></div>
      {feedback.professionalSaved === "1" ? <p className="form-message" role="status">Perfil profesional guardado.</p> : null}
      {feedback.professionalError ? <p className="form-message form-message--error" role="alert">{feedbackMessage(feedback.professionalError)}</p> : null}
      <details className="admin-disclosure admin-create-disclosure"><summary><span><Plus aria-hidden="true" strokeWidth={1.75} />Agregar profesional</span><ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary><ProfessionalForm specialties={specialties} /></details>
      {professionals.length === 0 ? <div className="admin-empty"><UserRound aria-hidden="true" strokeWidth={1.75} /><h3>Todavía no hay profesionales.</h3><p>Creá el primer perfil para poder asignarlo a tratamientos.</p></div> : (
        <div className="admin-professional-list">
          {professionals.map((professional) => (
            <details className="admin-professional-item" key={professional.id}>
              <summary>
                <span className="admin-professional-avatar" aria-hidden="true">{(professional.public_name || professional.full_name).slice(0, 1).toLocaleUpperCase("es-AR")}</span>
                <span><strong>{professional.public_name || professional.full_name}</strong><small>{specialtyName.get(professional.specialty_id)} · {professional.assigned_treatment_count} tratamientos</small></span>
                <span className={`status-badge ${professional.is_active ? "status-confirmed" : "status-expired"}`}>{professional.is_active ? "Activo" : "Inactivo"}</span>
                <ChevronDown aria-hidden="true" strokeWidth={1.75} />
              </summary>
              <ProfessionalForm specialties={specialties} professional={professional} />
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function ProfessionalForm({ specialties, professional }: { specialties: SpecialtyRow[]; professional?: ProfessionalRow }) {
  return (
    <form action={saveProfessional} className="admin-form admin-form--professional">
      {professional ? <input type="hidden" name="professionalId" value={professional.id} /> : null}
      <div className="admin-form-grid admin-form-grid--3"><label>Nombre interno<input name="fullName" defaultValue={professional?.full_name ?? ""} minLength={2} maxLength={100} required /></label><label>Nombre público opcional<input name="publicName" defaultValue={professional?.public_name ?? ""} maxLength={100} /></label><label>Especialidad<select name="specialtyId" defaultValue={professional?.specialty_id ?? ""} required><option value="">Seleccionar</option>{specialties.filter((item) => item.is_active || item.id === professional?.specialty_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <label>Presentación opcional<textarea name="bio" defaultValue={professional?.bio ?? ""} rows={4} maxLength={1400} /></label>
      <div className="admin-form-grid"><label>Orden<input name="displayOrder" type="number" min="0" max="999" defaultValue={professional?.display_order ?? 0} required /></label><label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={professional?.is_active ?? true} /><span>Disponible para asignar y mostrar</span></label></div>
      {professional && professional.assigned_treatment_count > 0 ? <label className="admin-impact-check"><input type="checkbox" name="confirmImpact" /><span><strong>{professional.assigned_treatment_count} tratamientos asignados.</strong> Confirmo que, si lo desactivo, el nombre dejará de mostrarse públicamente.</span></label> : null}
      <div className="admin-form-footer"><p>El nombre interno organiza el panel; el nombre público es el que verá la persona.</p><button className="button button--primary" type="submit">Guardar profesional</button></div>
    </form>
  );
}

