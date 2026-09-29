import Link from "next/link";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";
import { requireOwner } from "@/lib/admin/require-admin";
import { reconcileProfessionalIdentity } from "./actions";

const errors: Record<string, string> = {
  invalid: "Seleccioná dos perfiles diferentes, el motivo, el respaldo y la confirmación.",
  conflict: "Hay turnos superpuestos o un bloqueo incompatible. No se modificó ningún dato. Revisá el informe de conflictos antes de continuar.",
  schedule: "Existen horarios personalizados por profesional. Se necesita acordar la disponibilidad unificada antes de conciliar. No se aplicaron cambios.",
  archived: "Uno de estos perfiles ya forma parte de una conciliación. No se permite encadenar fusiones automáticamente.",
  failed: "No se pudo completar la conciliación. Verificá que la migración esté aplicada y revisá el informe previo. No repitas sin comprobar el historial.",
};

export default async function ReconcileProfessionalsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase } = await requireOwner();
  const params = await searchParams;
  const { data, error } = await supabase.from("professionals").select("id,full_name,public_name,is_active,specialty:specialties(name)").order("full_name");
  return <div className="live-admin site-container">
    <header className="live-admin__header"><div><h1>Conciliar identidades</h1><p>Operación de Kai Studio. No crea ni elimina personas; concentra la agenda de dos perfiles que representan a la misma persona.</p></div></header>
    <AdminRouteNav current="professionals" canManageAccess />
    <Link className="text-link" href="/admin/profesionales">Volver a profesionales</Link>
    {params.saved === "1" ? <p className="form-message" role="status">Identidad conciliada. El perfil de origen quedó archivado. Compará el inventario y verificá la agenda antes de reabrir reservas.</p> : null}
    {params.error ? <p className="form-message form-message--error" role="alert">{errors[params.error] ?? errors.failed}</p> : null}
    {error ? <p role="alert">No pudimos consultar los perfiles. No se puede conciliar hasta recuperar la consulta.</p> : <form action={reconcileProfessionalIdentity} className="admin-form">
      <p>Antes de continuar: exportá el respaldo operativo, ejecutá el informe de conflictos y confirmá con recepción los dos IDs. No uses coincidencias de nombre como prueba de identidad. La operación puede bloquear brevemente nuevas reservas.</p>
      <div className="admin-form-grid">{(["source", "target"] as const).map((field) => <label key={field}>{field === "source" ? "Perfil que se archivará" : "Perfil que conservará la agenda"}<select name={field} defaultValue="" required><option value="">Seleccionar un perfil</option>{(data ?? []).filter((person) => field === "source" || person.is_active).map((person) => {
        const specialty = Array.isArray(person.specialty) ? person.specialty[0] : person.specialty;
        return <option key={person.id} value={person.id}>{person.public_name || person.full_name} · {specialty?.name} · {person.id}</option>;
      })}</select></label>)}</div>
      <label>Referencia del respaldo verificado<input name="backup" required minLength={10} maxLength={500} placeholder="Identificador del respaldo y fecha de comprobación" /></label>
      <label>Motivo de la conciliación<textarea name="reason" required minLength={10} maxLength={1000} /></label>
      <label className="admin-check"><input name="confirmed" type="checkbox" required /><span>Confirmé que es la misma persona, revisé los conflictos y comprobé que el respaldo permite recuperar relaciones, horarios y reservas.</span></label>
      <p>Los IDs, horarios, estados y snapshots de las reservas se conservan; cambia la asignación al profesional. Si hay conflictos, la operación completa se cancela. No existe deshacer automático.</p>
      <AdminSubmitButton pendingLabel="Verificando y conciliando…">Conciliar perfiles revisados</AdminSubmitButton>
    </form>}
  </div>;
}
