export type AuditAction = "insert" | "update" | "delete";

export interface AuditRecord {
  id: number;
  actor_id: string | null;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface OperationalAuditRecord {
  id: number;
  actor_id: string | null;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  changed_fields: string[];
  entity_reference: string | null;
  is_restorable: boolean;
  created_at: string;
}

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  profiles: "Accesos",
  bookings: "Reservas",
  customers: "Clientes",
  treatments: "Tratamientos",
  treatment_categories: "Categorías",
  specialties: "Especialidades",
  professionals: "Profesionales",
  professional_specialties: "Especialidades del profesional",
  treatment_professionals: "Profesionales del tratamiento",
  monthly_specials: "Especiales del mes",
  availability_rules: "Horarios habituales",
  availability_exceptions: "Excepciones de agenda",
  business_settings: "Configuración",
  site_content: "Contenido del sitio",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  insert: "Creación",
  update: "Edición",
  delete: "Eliminación",
};

const ignoredFields = new Set(["updated_at"]);
const privateFields = new Set([
  "phone",
  "email",
  "customer_notes",
  "internal_notes",
  "deposit_text",
  "cancellation_policy",
]);

const fieldLabels: Record<string, string> = {
  status: "Estado",
  status_reason: "Motivo del estado",
  starts_at: "Fecha y horario",
  ends_at: "Finalización",
  reschedule_count: "Reprogramaciones",
  full_name: "Nombre",
  name: "Nombre",
  title: "Título",
  price_cents: "Precio",
  special_price_cents: "Precio especial",
  duration_minutes: "Duración",
  start_interval_minutes: "Frecuencia de inicio",
  buffer_minutes: "Preparación entre turnos",
  display_order: "Orden",
  specialty_id: "Especialidad",
  category_id: "Categoría",
  public_name: "Nombre público",
  bio: "Presentación",
  selection_mode: "Forma de reserva",
  is_active: "Estado activo",
  business_name: "Nombre comercial",
  whatsapp_number: "WhatsApp público",
  address: "Dirección",
  public_email: "Correo público",
  internal_notes: "Nota interna",
  customer_notes: "Observación de la persona",
};

function comparable(value: unknown) {
  return JSON.stringify(value ?? null);
}

function fieldDescriptor(key: string) {
  return {
    key,
    label: fieldLabels[key] ?? key.replaceAll("_", " "),
    isPrivate: privateFields.has(key),
  };
}

export function auditChangedFields(record: AuditRecord | OperationalAuditRecord) {
  if ("changed_fields" in record) {
    return record.changed_fields
      .filter((key) => !ignoredFields.has(key))
      .map(fieldDescriptor);
  }

  const before = record.old_data ?? {};
  const after = record.new_data ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !ignoredFields.has(key))
    .filter((key) => record.action !== "update" || comparable(before[key]) !== comparable(after[key]))
    .map(fieldDescriptor);
}

export function auditEntityReference(record: AuditRecord | OperationalAuditRecord) {
  if ("entity_reference" in record) return record.entity_reference;

  const data = record.new_data ?? record.old_data ?? {};
  const candidate = data.booking_code ?? data.name ?? data.title ?? data.full_name;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

export function auditSearchText(record: AuditRecord | OperationalAuditRecord, actorName: string) {
  const tableLabel = AUDIT_TABLE_LABELS[record.table_name] ?? record.table_name;
  const actionLabel = AUDIT_ACTION_LABELS[record.action];
  const reference = auditEntityReference(record) ?? "";
  return `${tableLabel} ${actionLabel} ${reference} ${actorName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
