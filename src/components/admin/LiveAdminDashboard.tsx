import { Clock3, LogOut, Plus, Trash2 } from "lucide-react";
import {
  createAvailabilityRule,
  deleteAvailabilityRule,
  signOutAdmin,
} from "@/app/admin/actions";

interface SpecialtyRow {
  id: string;
  name: string;
}

interface AvailabilityRuleRow {
  id: string;
  specialty_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_interval_minutes: number;
}

interface LiveAdminDashboardProps {
  adminName: string;
  specialties: SpecialtyRow[];
  rules: AvailabilityRuleRow[];
  bookingCount: number;
  pendingCount: number;
  confirmedCount: number;
  availabilitySaved: boolean;
  availabilityError?: string;
}

const weekdayNames = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function LiveAdminDashboard({
  adminName,
  specialties,
  rules,
  bookingCount,
  pendingCount,
  confirmedCount,
  availabilitySaved,
  availabilityError,
}: LiveAdminDashboardProps) {
  const specialtyName = new Map(specialties.map((item) => [item.id, item.name]));

  return (
    <div className="live-admin site-container">
      <header className="live-admin__header">
        <div>
          <p className="eyebrow">Panel operativo</p>
          <h1>Hola, {adminName}</h1>
          <p>Configuración real conectada a Supabase.</p>
        </div>
        <form action={signOutAdmin}>
          <button className="button button--quiet" type="submit">
            <LogOut aria-hidden="true" strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </form>
      </header>

      <section className="admin-summary-grid" aria-label="Resumen de reservas">
        <article><span>Reservas</span><strong>{bookingCount}</strong></article>
        <article><span>Pendientes</span><strong>{pendingCount}</strong></article>
        <article><span>Confirmadas</span><strong>{confirmedCount}</strong></article>
      </section>

      <section className="live-admin__section" id="disponibilidad" aria-labelledby="availability-title">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Agenda por especialidad</p>
            <h2 id="availability-title">Disponibilidad habitual</h2>
          </div>
          <p>
            Cada especialidad administra su propia capacidad. Especialidades distintas pueden atender en paralelo.
          </p>
        </div>

        {availabilitySaved ? <p className="form-message" role="status">Disponibilidad actualizada.</p> : null}
        {availabilityError ? <p className="form-message form-message--error" role="alert">No se pudo guardar el cambio.</p> : null}

        <div className="availability-admin-grid">
          <form action={createAvailabilityRule} className="availability-form">
            <h3>Agregar horario</h3>
            <label>
              Especialidad
              <select name="specialtyId" required>
                <option value="">Seleccionar</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                ))}
              </select>
            </label>
            <label>
              Día
              <select name="weekday" defaultValue="1" required>
                {weekdayNames.map((name, index) => (
                  <option key={name} value={index}>{name}</option>
                ))}
              </select>
            </label>
            <div className="availability-form__times">
              <label>Desde<input name="startTime" type="time" defaultValue="09:00" required /></label>
              <label>Hasta<input name="endTime" type="time" defaultValue="18:00" required /></label>
            </div>
            <label>
              Intervalo entre inicios
              <select name="slotIntervalMinutes" defaultValue="15">
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">60 minutos</option>
              </select>
            </label>
            <button className="button button--primary" type="submit">
              <Plus aria-hidden="true" strokeWidth={1.75} />
              Agregar horario
            </button>
          </form>

          <div className="availability-list">
            <h3>Horarios configurados</h3>
            {rules.length === 0 ? (
              <p className="availability-empty">Todavía no hay horarios habilitados.</p>
            ) : (
              <ul>
                {rules.map((rule) => (
                  <li key={rule.id}>
                    <Clock3 aria-hidden="true" strokeWidth={1.75} />
                    <div>
                      <strong>{specialtyName.get(rule.specialty_id) ?? "Especialidad"}</strong>
                      <span>{weekdayNames[rule.weekday]} · {rule.start_time.slice(0, 5)} a {rule.end_time.slice(0, 5)}</span>
                    </div>
                    <form action={deleteAvailabilityRule}>
                      <input name="id" type="hidden" value={rule.id} />
                      <button className="icon-button" type="submit" aria-label="Eliminar horario">
                        <Trash2 aria-hidden="true" strokeWidth={1.75} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
