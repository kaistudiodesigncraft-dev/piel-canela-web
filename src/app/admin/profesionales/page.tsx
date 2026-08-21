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
  const [specialtiesResult, professionalsResult, treatmentsResult] = await Promise.all([
    supabase.from("specialties").select("id,name,is_active").order("display_order"),
    supabase.from("professionals").select("id,specialty_id,full_name,public_name,bio,is_active,display_order").order("display_order").order("full_name"),
    supabase.from("treatments").select("professional_id").not("professional_id", "is", null),
  ]);
  const firstError = specialtiesResult.error ?? professionalsResult.error ?? treatmentsResult.error;
  if (firstError) throw new Error(`No se pudo cargar el equipo profesional: ${firstError.message}`);
  const assignmentCounts = new Map<string, number>();
  for (const treatment of treatmentsResult.data ?? []) if (treatment.professional_id) assignmentCounts.set(treatment.professional_id, (assignmentCounts.get(treatment.professional_id) ?? 0) + 1);
  const professionals = (professionalsResult.data ?? []).map((item) => ({ ...item, assigned_treatment_count: assignmentCounts.get(item.id) ?? 0 }));
  return (
    <div className="live-admin site-container">
      <header className="live-admin__header"><div><p className="eyebrow">Equipo de atención</p><h1>Personas, especialidades y presentación pública.</h1><p>{profile.full_name}, cada perfil puede reutilizarse en varios tratamientos de su especialidad.</p></div><div className="live-admin__actions"><Link className="button button--quiet" href="/tratamientos" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver catálogo</Link><form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form></div></header>
      <AdminRouteNav current="professionals" />
      <ProfessionalsAdmin specialties={specialtiesResult.data ?? []} professionals={professionals} feedback={await searchParams} />
    </div>
  );
}
