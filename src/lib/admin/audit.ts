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
  field_changes?: AuditFieldChange[];
  entity_reference: string | null;
  is_restorable: boolean;
  created_at: string;
}

export interface AuditFieldChange {
  key: string;
  before: unknown;
  after: unknown;
  isPrivate?: boolean;
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

function displayAuditValue(value: unknown) {
  if (value === null || value === undefined) return "Vacío";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("es-AR").format(value);
  if (typeof value === "string") {
    if (!value.trim()) return "Vacío";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      return "Referencia vinculada";
    }
    return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  }
  if (Array.isArray(value)) return value.length === 0 ? "Sin elementos" : `${value.length} elementos`;
  return "Valor técnico actualizado";
}

export function auditFieldComparisons(record: OperationalAuditRecord) {
  if (!Array.isArray(record.field_changes) || record.field_changes.length === 0) {
    return auditChangedFields(record).map((field) => ({
      ...field,
      before: "",
      after: field.isPrivate ? "Contenido protegido actualizado" : record.action === "insert" ? "Definido" : record.action === "delete" ? "Eliminado" : "Actualizado",
      hasValues: false,
    }));
  }

  return record.field_changes
    .filter((field) => !ignoredFields.has(field.key))
    .map((field) => {
      const descriptor = fieldDescriptor(field.key);
      const isPrivate = descriptor.isPrivate || field.isPrivate;
      return {
        ...descriptor,
        isPrivate,
        before: isPrivate ? "Contenido protegido" : displayAuditValue(field.before),
        after: isPrivate ? "Contenido protegido" : displayAuditValue(field.after),
        hasValues: !isPrivate,
      };
    });
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
