import { CalendarRange, MessageCircle, ShieldCheck } from "lucide-react";
import { saveBusinessSettings } from "@/app/admin/configuracion/actions";

export interface BusinessSettingsRow {
  singleton: boolean;
  business_name: string;
  timezone: string;
  minimum_notice_minutes: number;
  maximum_advance_days: number;
  pending_expiry_minutes: number;
  whatsapp_number: string | null;
  address: string | null;
  public_email: string | null;
  instagram_url: string | null;
  deposit_text: string | null;
  cancellation_policy: string | null;
  updated_at: string;
}

export function BusinessSettingsAdmin({ settings, feedback }: { settings: BusinessSettingsRow; feedback: Record<string, string | undefined> }) {
  return (
    <section className="live-admin__section admin-settings" id="ajustes" aria-labelledby="settings-title">
      <div className="admin-section-heading"><div><h2 id="settings-title">Configuración general</h2><p>Los datos públicos aparecen en la web. Las reglas de agenda se validan en servidor antes de ofrecer o guardar un horario.</p></div><ShieldCheck aria-hidden="true" strokeWidth={1.75} /></div>
      {feedback.settingsSaved === "1" ? <p className="form-message" role="status">Configuración actualizada.</p> : null}
      {feedback.settingsError ? <p className="form-message form-message--error" role="alert">Revisá los valores e intentá nuevamente.</p> : null}
      <form action={saveBusinessSettings} className="admin-form admin-form--settings">
        <fieldset>
          <legend>Identidad y contacto público</legend>
          <div className="admin-form-grid admin-form-grid--3"><label>Nombre comercial<input name="businessName" minLength={2} maxLength={100} defaultValue={settings.business_name} required /></label><label>WhatsApp<small>Con código de país, solo un número operativo.</small><input name="whatsappNumber" type="tel" maxLength={30} defaultValue={settings.whatsapp_number ?? ""} /></label><label>Correo público<input name="publicEmail" type="email" maxLength={180} defaultValue={settings.public_email ?? ""} /></label></div>
          <label>Dirección o referencia del local<input name="address" maxLength={240} defaultValue={settings.address ?? ""} /></label>
          <label>Instagram<small>URL completa, por ejemplo https://instagram.com/pielcanela</small><input name="instagramUrl" type="url" maxLength={500} defaultValue={settings.instagram_url ?? ""} /></label>
        </fieldset>
        <fieldset>
          <legend>Reglas del calendario</legend>
          <div className="admin-settings-context"><CalendarRange aria-hidden="true" strokeWidth={1.75} /><p>Zona horaria fija: <strong>{settings.timezone}</strong>. Cambiar estas reglas modifica los próximos horarios ofrecidos, no las reservas existentes.</p></div>
          <div className="admin-form-grid admin-form-grid--3"><label>Anticipación mínima<small>Minutos antes del turno.</small><input name="minimumNoticeMinutes" type="number" min="0" max="10080" step="15" defaultValue={settings.minimum_notice_minutes} required /></label><label>Ventana máxima<small>Días disponibles hacia adelante.</small><input name="maximumAdvanceDays" type="number" min="1" max="365" defaultValue={settings.maximum_advance_days} required /></label><label>Vencimiento pendiente<small>Minutos para liberar una pre-reserva.</small><input name="pendingExpiryMinutes" type="number" min="15" max="1440" step="15" defaultValue={settings.pending_expiry_minutes} required /></label></div>
        </fieldset>
        <fieldset>
          <legend>Seña y cancelación</legend>
          <div className="admin-settings-context"><MessageCircle aria-hidden="true" strokeWidth={1.75} /><p>La transferencia sigue coordinándose por WhatsApp. No se publican alias ni datos bancarios sensibles en el catálogo.</p></div>
          <label>Instrucción de seña<textarea name="depositText" rows={4} maxLength={1000} defaultValue={settings.deposit_text ?? ""} /></label>
          <label>Política de cancelación<textarea name="cancellationPolicy" rows={5} maxLength={2000} defaultValue={settings.cancellation_policy ?? ""} /></label>
        </fieldset>
        <div className="admin-form-footer"><p>Última actualización: {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Cordoba" }).format(new Date(settings.updated_at))}</p><button className="button button--primary" type="submit">Guardar configuración</button></div>
      </form>
    </section>
  );
}
