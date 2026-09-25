import { Boxes, CircleDollarSign, Plus, Trash2 } from "lucide-react";
import { deleteDepilationZone, deleteTreatmentCombo, saveDepilationZone, saveTreatmentCombo, saveTreatmentComboExtra, toggleDepilationFeature } from "@/app/admin/catalogo/[id]/combos/actions";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";
import { ComboSessionFields } from "@/components/admin/ComboSessionFields";
import { formatDuration, formatPrice } from "@/lib/format";

type Audience = "women" | "men" | "shared";
interface ZoneRow { id: string; name: string; audience: Audience; reference_price_cents: number; duration_minutes: number; is_active: boolean; display_order: number; link_count: number }
interface ExtraRow { id: string; treatment_id: string; name: string; description: string; audience: Audience; price_cents: number; duration_minutes: number; is_active: boolean; display_order: number }
interface ComboRow { id: string; name: string; description: string; audience: Audience; mode: "single_session" | "package"; session_count: number; pricing_mode: "fixed_price" | "percentage_discount" | "tiered_discount"; discount_percent: number | string | null; tier_min_items: number | null; tier_discount_percent: number | string | null; allow_public_extras: boolean; fixed_price_cents: number; validity_days: number | null; is_active: boolean; display_order: number; zone_ids: string[]; extra_ids: string[]; booking_count: number; package_count: number }

const audienceLabels: Record<Audience, string> = { women: "Mujeres", men: "Hombres", shared: "Compartido" };

function ProtectedDeleteForm({ treatmentId, recordId, label, action }: { treatmentId: string; recordId: string; label: string; action: (formData: FormData) => void | Promise<void> }) {
  return <form action={action} className="admin-delete-treatment__form depilation-delete-form">
    <input type="hidden" name="treatmentId" value={treatmentId} />
    <input type="hidden" name="recordId" value={recordId} />
    <label>Código de eliminación<input name="confirmationCode" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={128} autoComplete="off" required /></label>
    <label className="admin-check"><input name="confirmDeletion" type="checkbox" required /><span>Confirmo que quiero eliminar “{label}”.</span></label>
    <AdminSubmitButton className="button button--danger" pendingLabel="Eliminando…"><Trash2 aria-hidden="true" />Eliminar definitivamente</AdminSubmitButton>
  </form>;
}

function ZoneForm({ treatmentId, zone }: { treatmentId: string; zone?: ZoneRow }) {
  return <form action={saveDepilationZone} className="admin-form depilation-zone-form">
    <input type="hidden" name="treatmentId" value={treatmentId} />
    {zone ? <input type="hidden" name="zoneId" value={zone.id} /> : null}
    <div className="admin-form-grid admin-form-grid--3">
      <label>Nombre de la zona<input name="name" defaultValue={zone?.name ?? ""} minLength={2} maxLength={100} required /></label>
      <label>Etiqueta<select name="audience" defaultValue={zone?.audience ?? "shared"}>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Orden<input name="displayOrder" type="number" min="0" max="999" defaultValue={zone?.display_order ?? 0} required /></label>
    </div>
    <div className="admin-form-grid">
      <label>Valor individual de referencia<input name="referencePricePesos" type="number" min="0" step="1" defaultValue={zone ? zone.reference_price_cents / 100 : ""} required /></label>
      <label>Duración de la zona<input name="durationMinutes" type="number" min="5" max="240" step="5" defaultValue={zone?.duration_minutes ?? 15} required /></label>
    </div>
    <label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={zone?.is_active ?? true} /><span>Disponible para armar combos</span></label>
    <AdminSubmitButton pendingLabel="Guardando zona…">{zone ? "Guardar zona" : "Crear zona"}</AdminSubmitButton>
  </form>;
}

function ExtraForm({ treatmentId, extra }: { treatmentId: string; extra?: ExtraRow }) {
  return <form action={saveTreatmentComboExtra} className="admin-form depilation-zone-form">
    <input type="hidden" name="treatmentId" value={treatmentId} />
    {extra ? <input type="hidden" name="extraId" value={extra.id} /> : null}
    <div className="admin-form-grid admin-form-grid--3">
      <label>Nombre del extra<input name="name" defaultValue={extra?.name ?? ""} minLength={2} maxLength={100} required /></label>
      <label>Etiqueta<select name="audience" defaultValue={extra?.audience ?? "shared"}>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Orden<input name="displayOrder" type="number" min="0" max="999" defaultValue={extra?.display_order ?? 0} required /></label>
    </div>
    <label>Descripción breve<textarea name="description" defaultValue={extra?.description ?? ""} rows={2} maxLength={500} /></label>
    <div className="admin-form-grid">
      <label>Precio del extra<input name="pricePesos" type="number" min="0" step="1" defaultValue={extra ? extra.price_cents / 100 : ""} required /></label>
      <label>Duración adicional<input name="durationMinutes" type="number" min="0" max="240" step="5" defaultValue={extra?.duration_minutes ?? 0} required /></label>
    </div>
    <label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={extra?.is_active ?? true} /><span>Disponible como extra opcional</span></label>
    <AdminSubmitButton pendingLabel="Guardando extra…">{extra ? "Guardar extra" : "Crear extra"}</AdminSubmitButton>
  </form>;
}

function ComboForm({ treatmentId, zones, extras, combo }: { treatmentId: string; zones: ZoneRow[]; extras: ExtraRow[]; combo?: ComboRow }) {
  return <form action={saveTreatmentCombo} className="admin-form depilation-combo-form">
    <input type="hidden" name="treatmentId" value={treatmentId} />
    {combo ? <input type="hidden" name="comboId" value={combo.id} /> : null}
    <div className="admin-form-grid admin-form-grid--3">
      <label>Nombre del combo<input name="name" defaultValue={combo?.name ?? ""} minLength={2} maxLength={120} required /></label>
      <label>Etiqueta<select name="audience" defaultValue={combo?.audience ?? "shared"}>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Orden<input name="displayOrder" type="number" min="0" max="999" defaultValue={combo?.display_order ?? 0} required /></label>
    </div>
    <label>Descripción breve<textarea name="description" defaultValue={combo?.description ?? ""} rows={2} maxLength={500} /></label>
    <ComboSessionFields initialMode={combo?.mode ?? "single_session"} sessionCount={combo?.session_count ?? 1} validityDays={combo?.validity_days ?? null} />
    <div className="admin-form-grid admin-form-grid--3">
      <label>Regla de precio<select name="pricingMode" defaultValue={combo?.pricing_mode ?? "fixed_price"}><option value="fixed_price">Precio final manual</option><option value="percentage_discount">Descuento porcentual</option><option value="tiered_discount">Descuento por cantidad</option></select></label>
      <label>Precio total base<input name="fixedPricePesos" type="number" min="1" step="1" defaultValue={combo ? combo.fixed_price_cents / 100 : ""} required /><small>Se usa como precio final si la regla es manual.</small></label>
      <label>Descuento %<input name="discountPercent" type="number" min="0" max="100" step="0.01" defaultValue={combo?.discount_percent ?? ""} /></label>
    </div>
    <div className="admin-form-grid">
      <label>Cantidad mínima para descuento<input name="tierMinItems" type="number" min="1" max="99" defaultValue={combo?.tier_min_items ?? ""} /></label>
      <label>Descuento por cantidad %<input name="tierDiscountPercent" type="number" min="0" max="100" step="0.01" defaultValue={combo?.tier_discount_percent ?? ""} /></label>
    </div>
    <fieldset className="depilation-zone-picker"><legend>Zonas incluidas</legend>{zones.filter((zone) => zone.is_active || combo?.zone_ids.includes(zone.id)).map((zone) => <label className="admin-check" key={zone.id}><input type="checkbox" name="zoneIds" value={zone.id} defaultChecked={combo?.zone_ids.includes(zone.id)} /><span><strong>{zone.name}</strong><small>{audienceLabels[zone.audience]} · {formatDuration(zone.duration_minutes)} · {formatPrice(zone.reference_price_cents)}</small></span></label>)}</fieldset>
    <label className="admin-check"><input name="allowPublicExtras" type="checkbox" defaultChecked={combo?.allow_public_extras ?? false} /><span>Permitir que el público sume extras habilitados</span></label>
    <fieldset className="depilation-zone-picker"><legend>Extras compatibles</legend>{extras.length === 0 ? <p className="admin-field-note">Todavía no hay extras. Podés crearlos en el bloque de abajo.</p> : extras.filter((extra) => extra.is_active || combo?.extra_ids.includes(extra.id)).map((extra) => <label className="admin-check" key={extra.id}><input type="checkbox" name="extraIds" value={extra.id} defaultChecked={combo?.extra_ids.includes(extra.id)} /><span><strong>{extra.name}</strong><small>{audienceLabels[extra.audience]} · +{formatDuration(extra.duration_minutes)} · {formatPrice(extra.price_cents)}</small></span></label>)}</fieldset>
    <label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={combo?.is_active ?? false} /><span>Publicar este combo</span></label>
    <AdminSubmitButton pendingLabel="Guardando combo…">{combo ? "Guardar combo" : "Crear combo"}</AdminSubmitButton>
  </form>;
}

export function DepilationComboAdmin({ treatmentId, treatmentName, treatmentBufferMinutes, startIntervalMinutes, featureEnabled, zones, extras, combos, feedback }: { treatmentId: string; treatmentName: string; treatmentBufferMinutes: number; startIntervalMinutes: number; featureEnabled: boolean; zones: ZoneRow[]; extras: ExtraRow[]; combos: ComboRow[]; feedback: Record<string, string | undefined> }) {
  return <div className="depilation-admin">
    {combos.some((combo) => combo.booking_count < 0 || combo.package_count < 0) ? <p className="form-message form-message--error" role="alert">No pudimos verificar todo el historial. Podés editar los combos, pero su eliminación queda bloqueada hasta volver a consultar la página.</p> : null}
    <p className="admin-field-note">Las zonas se comparten entre combos. Cambiar su precio o duración afecta los cálculos de próximas reservas; no modifica los paquetes ni los turnos ya contratados.</p>
    <section className="live-admin__section depilation-feature-control">
      <div><p className="eyebrow">Publicación controlada</p><h2>Combos de {treatmentName}</h2><p>Podés preparar zonas y combos sin mostrarlos. Cada turno suma {treatmentBufferMinutes} min de preparación y puede comenzar cada {startIntervalMinutes} min.</p></div>
      <form action={toggleDepilationFeature}><input type="hidden" name="treatmentId" value={treatmentId} /><input type="hidden" name="enabled" value={String(!featureEnabled)} /><AdminSubmitButton className={`button ${featureEnabled ? "button--quiet" : "button--primary"}`} pendingLabel="Aplicando…">{featureEnabled ? "Pausar selector público" : "Habilitar selector público"}</AdminSubmitButton></form>
    </section>
    {feedback.zoneSaved === "1" || feedback.extraSaved === "1" || feedback.comboSaved === "1" || feedback.featureSaved === "1" ? <p className="form-message" role="status">Los cambios quedaron guardados.</p> : null}
    {feedback.zoneDeleted === "1" || feedback.comboDeleted === "1" ? <p className="form-message" role="status">El elemento sin historial fue eliminado.</p> : null}
    {feedback.zoneError || feedback.extraError || feedback.comboError || feedback.featureError ? <p className="form-message form-message--error" role="alert">{feedback.featureError === "activeTreatments" ? "Antes de pausar el selector, desactivá los tratamientos que usan combos cerrados." : "No pudimos guardar. Revisá los datos, las zonas/extras elegidos y que no exista otro nombre igual."}</p> : null}
    {feedback.deleteError ? <p className="form-message form-message--error" role="alert">{feedback.deleteError === "linked" ? "No puede eliminarse porque ya está vinculado. Pausalo para conservar el historial." : "No pudimos validar la eliminación. Revisá el código e intentá nuevamente."}</p> : null}

    <section className="live-admin__section" aria-labelledby="zones-title"><div className="admin-section-heading"><div><h2 id="zones-title">Zonas disponibles</h2><p>Son piezas reutilizables. Su valor individual permite calcular el ahorro del combo.</p></div><span className="admin-count numeric">{zones.length} zonas</span></div>
      <details className="admin-disclosure admin-create-disclosure"><summary><span><Plus aria-hidden="true" />Agregar zona</span></summary><ZoneForm treatmentId={treatmentId} /></details>
      <div className="depilation-admin-list">{zones.map((zone) => <details key={zone.id} className="admin-disclosure"><summary><span><strong>{zone.name}</strong><small>{audienceLabels[zone.audience]} · {formatDuration(zone.duration_minutes)} · {formatPrice(zone.reference_price_cents)}</small></span><span className={`status-badge ${zone.is_active ? "status-confirmed" : "status-expired"}`}>{zone.is_active ? "Activa" : "Pausada"}</span></summary><ZoneForm treatmentId={treatmentId} zone={zone} />{zone.link_count === 0 ? <ProtectedDeleteForm treatmentId={treatmentId} recordId={zone.id} label={zone.name} action={deleteDepilationZone} /> : <p className="depilation-reference-note">Esta zona integra {zone.link_count} {zone.link_count === 1 ? "combo" : "combos"}. Puede pausarse, pero no eliminarse.</p>}</details>)}</div>
    </section>

    <section className="live-admin__section" aria-labelledby="extras-title"><div className="admin-section-heading"><div><h2 id="extras-title">Extras opcionales</h2><p>Son agregados que pueden habilitarse dentro de un combo publicado.</p></div><span className="admin-count numeric">{extras.length} extras</span></div>
      <details className="admin-disclosure admin-create-disclosure"><summary><span><Plus aria-hidden="true" />Agregar extra</span></summary><ExtraForm treatmentId={treatmentId} /></details>
      <div className="depilation-admin-list">{extras.map((extra) => <details key={extra.id} className="admin-disclosure"><summary><span><strong>{extra.name}</strong><small>{audienceLabels[extra.audience]} · +{formatDuration(extra.duration_minutes)} · {formatPrice(extra.price_cents)}</small></span><span className={`status-badge ${extra.is_active ? "status-confirmed" : "status-expired"}`}>{extra.is_active ? "Activo" : "Pausado"}</span></summary><ExtraForm treatmentId={treatmentId} extra={extra} /></details>)}</div>
    </section>

    <section className="live-admin__section" aria-labelledby="combos-title"><div className="admin-section-heading"><div><h2 id="combos-title">Combos cerrados</h2><p>El público elige una opción completa; no agrega ni quita zonas.</p></div><span className="admin-count numeric">{combos.length} combos</span></div>
      {zones.some((zone) => zone.is_active) ? <details className="admin-disclosure admin-create-disclosure"><summary><span><Plus aria-hidden="true" />Agregar combo</span></summary><ComboForm treatmentId={treatmentId} zones={zones} extras={extras} /></details> : <div className="admin-empty"><Boxes aria-hidden="true" /><h3>Primero creá una zona activa</h3><p>Después vas a poder combinarla con otras y definir el precio final.</p></div>}
      <div className="depilation-admin-list">{combos.map((combo) => {
        const selectedZones = zones.filter((zone) => combo.zone_ids.includes(zone.id));
        const reference = selectedZones.reduce((total, zone) => total + zone.reference_price_cents, 0) * combo.session_count;
        const duration = selectedZones.reduce((total, zone) => total + zone.duration_minutes, 0);
        const extraCount = combo.extra_ids.length;
        return <details key={combo.id} className="admin-disclosure"><summary><span><strong>{combo.name}</strong><small>{audienceLabels[combo.audience]} · {combo.mode === "package" ? `${combo.session_count} sesiones` : "Una sesión"} · ocupa {formatDuration(duration + treatmentBufferMinutes)}{combo.allow_public_extras ? ` · ${extraCount} extras posibles` : ""}</small></span><span className="depilation-combo-price"><strong>{formatPrice(combo.fixed_price_cents)}</strong><small>{reference > combo.fixed_price_cents ? `${formatPrice(reference - combo.fixed_price_cents)} de ahorro` : combo.pricing_mode === "fixed_price" ? "Sin ahorro informado" : "Descuento calculado al reservar"}</small></span><span className={`status-badge ${combo.is_active ? "status-confirmed" : "status-expired"}`}>{combo.is_active ? "Publicado" : "Borrador"}</span></summary><div className="depilation-reference-note"><CircleDollarSign aria-hidden="true" /><p>{combo.booking_count > 0 || combo.package_count > 0 ? `Usado por ${combo.booking_count} reservas y ${combo.package_count} paquetes. Puede pausarse, pero no debe eliminarse.` : "Todavía no tiene historial y puede editarse libremente."}</p></div><ComboForm treatmentId={treatmentId} zones={zones} extras={extras} combo={combo} />{combo.booking_count === 0 && combo.package_count === 0 ? <ProtectedDeleteForm treatmentId={treatmentId} recordId={combo.id} label={combo.name} action={deleteTreatmentCombo} /> : null}</details>;
      })}</div>
    </section>
  </div>;
}
