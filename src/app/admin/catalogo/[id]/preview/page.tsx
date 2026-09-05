import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TreatmentDetailContent } from "@/components/treatments/TreatmentDetailContent";
import type { Treatment, TreatmentCategory } from "@/domain/treatment";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Vista previa de tratamiento",
  robots: { index: false, follow: false },
};

export default async function TreatmentPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: row } = await supabase.from("treatments")
    .select("id,category_id,specialty_id,professional_id,name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,start_interval_minutes,price_cents,preparation,contraindications,image_path,image_alt,image_focal_x,image_focal_y,is_active,display_order,created_at,updated_at,category:treatment_categories(id,name,slug,short_description,icon_name,display_order,is_active),professional:professionals(public_name,full_name,is_active)")
    .eq("id", id).single();
  if (!row) notFound();
  const categoryRaw = Array.isArray(row.category) ? row.category[0] : row.category;
  const professionalRaw = Array.isArray(row.professional) ? row.professional[0] : row.professional;
  if (!categoryRaw) notFound();
  const imageUrl = row.image_path
    ? row.image_path.startsWith("/") || row.image_path.startsWith("https://")
      ? row.image_path
      : supabase.storage.from("treatment-media").getPublicUrl(row.image_path).data.publicUrl
    : null;
  const category: TreatmentCategory = {
    id: categoryRaw.id,
    name: categoryRaw.name,
    slug: categoryRaw.slug as TreatmentCategory["slug"],
    shortDescription: categoryRaw.short_description,
    icon: categoryRaw.icon_name as TreatmentCategory["icon"],
    displayOrder: categoryRaw.display_order,
    isActive: categoryRaw.is_active,
  };
  const treatment: Treatment = {
    id: row.id,
    categoryId: row.category_id,
    specialtyId: row.specialty_id,
    professionalId: row.professional_id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    expectations: row.expectations,
    characteristics: row.characteristics,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
    startIntervalMinutes: row.start_interval_minutes,
    priceCents: row.price_cents,
    preparation: row.preparation,
    contraindications: row.contraindications,
    professional: professionalRaw?.is_active ? (professionalRaw.public_name || null) : null,
    image: imageUrl && row.image_alt ? {
      src: imageUrl,
      alt: row.image_alt,
      focalPoint: `${Math.round(Number(row.image_focal_x) * 100)}% ${Math.round(Number(row.image_focal_y) * 100)}%`,
      width: 1086,
      height: 1449,
    } : null,
    isActive: row.is_active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return <div className="admin-preview-page"><div className="admin-preview-banner"><strong>Vista previa administrativa</strong><span>{row.is_active ? "Publicado" : "Todavía no visible en el catálogo público"}</span></div><TreatmentDetailContent treatment={treatment} category={category} preview /></div>;
}
