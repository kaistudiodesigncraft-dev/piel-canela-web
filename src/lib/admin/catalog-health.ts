export interface AdminHealthNotice {
  id: "duplicate-professionals" | "missing-availability";
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

interface SpecialtyHealthRow {
  id: string;
  name: string;
  is_active: boolean;
}

interface AvailabilityHealthRow {
  specialty_id: string;
}

interface TreatmentHealthRow {
  specialty_id: string;
  is_active: boolean;
}

interface ProfessionalHealthRow {
  full_name: string;
  public_name: string | null;
  is_active: boolean;
}

function normalizedPersonName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-AR");
}

export function findDuplicateProfessionalNames(professionals: readonly ProfessionalHealthRow[]) {
  const names = new Map<string, { label: string; count: number }>();
  for (const professional of professionals) {
    if (!professional.is_active) continue;
    const label = (professional.public_name || professional.full_name).trim();
    const key = normalizedPersonName(label);
    if (!key) continue;
    const current = names.get(key);
    names.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
  }
  return [...names.values()].filter((item) => item.count > 1).map((item) => item.label);
}

export function buildAdminHealthNotices(input: {
  specialties: readonly SpecialtyHealthRow[];
  rules: readonly AvailabilityHealthRow[];
  treatments: readonly TreatmentHealthRow[];
  professionals: readonly ProfessionalHealthRow[];
}): AdminHealthNotice[] {
  const notices: AdminHealthNotice[] = [];
  const duplicateNames = findDuplicateProfessionalNames(input.professionals);
  if (duplicateNames.length > 0) {
    notices.push({
      id: "duplicate-professionals",
      title: "Hay perfiles profesionales con el mismo nombre",
      description: `${duplicateNames.join(", ")}. Si corresponden a la misma persona, la agencia debe conservar un único perfil activo para que su agenda no se divida. No se fusionará ni desactivará nada automáticamente.`,
      href: "/admin/profesionales",
      actionLabel: "Revisar profesionales",
    });
  }

  const specialtiesWithTreatments = new Set(input.treatments.filter((item) => item.is_active).map((item) => item.specialty_id));
  const specialtiesWithRules = new Set(input.rules.map((item) => item.specialty_id));
  const missingAvailability = input.specialties
    .filter((item) => item.is_active && specialtiesWithTreatments.has(item.id) && !specialtiesWithRules.has(item.id))
    .map((item) => item.name);
  if (missingAvailability.length > 0) {
    notices.push({
      id: "missing-availability",
      title: "Hay especialidades sin disponibilidad habitual",
      description: `${missingAvailability.join(", ")}. Sus tratamientos pueden permanecer publicados, pero no ofrecerán horarios hasta configurar al menos una franja.`,
      href: "/admin?module=availability",
      actionLabel: "Revisar disponibilidad",
    });
  }

  return notices;
}
