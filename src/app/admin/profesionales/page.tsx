import type { Metadata } from "next";
import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { ProfessionalsAdmin } from "@/components/admin/ProfessionalsAdmin";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Profesionales",
  description: "Gestión del equipo profesional de Piel Canela.",
};

export default async function ProfessionalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile } = await requireAdmin();
  const [specialtiesResult, professionalsResult, professionalSpecialtiesResult, usageResult] = await Promise.all([
    supabase.from("specialties").select("id,name,is_active").order("display_order"),
    supabase.from("professionals").select("id,specialty_id,full_name,public_name,phone,bio,internal_notes,is_active,display_order").order("display_order").order("full_name"),
    supabase.from("professional_specialties").select("professional_id,specialty_id"),
    supabase.rpc("get_professional_usage_counts"),
  ]);
  const firstError = specialtiesResult.error ?? professionalsResult.error ?? professionalSpecialtiesResult.error ?? usageResult.error;
  if (firstError) throw new Error(`No se pudo cargar el equipo profesional: ${firstError.message}`);
  const assignmentCounts = new Map<string, number>();
  const bookingCounts = new Map<string, number>();
  for (const usage of usageResult.data ?? []) {
    assignmentCounts.set(usage.professional_id, Number(usage.treatment_count));
    bookingCounts.set(usage.professional_id, Number(usage.booking_count));
  }
  const specialtiesByProfessional = new Map<string, string[]>();
  for (const row of professionalSpecialtiesResult.data ?? []) {
    specialtiesByProfessional.set(row.professional_id, [...(specialtiesByProfessional.get(row.professional_id) ?? []), row.specialty_id]);
  }
  const professionals = (professionalsResult.data ?? []).map((item) => ({
    ...item,
    specialty_ids: specialtiesByProfessional.get(item.id) ?? [item.specialty_id],
    assigned_treatment_count: assignmentCounts.get(item.id) ?? 0,
    booking_count: bookingCounts.get(item.id) ?? 0,
  }));
  return (
    <div className="live-admin site-container">
      <header className="live-admin__header"><div><h1>Profesionales</h1><p>Un perfil por persona, con sus tratamientos y especialidades.</p></div><div className="live-admin__actions"><Link className="button button--quiet" href="/tratamientos" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver catálogo</Link><form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form></div></header>
      <AdminRouteNav current="professionals" canManageAccess={profile.role === "admin"} />
      <ProfessionalsAdmin specialties={specialtiesResult.data ?? []} professionals={professionals} feedback={await searchParams} />
    </div>
  );
}
