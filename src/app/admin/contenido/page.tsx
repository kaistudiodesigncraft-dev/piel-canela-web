import type { Metadata } from "next";
import { ContentEditor } from "@/components/admin/ContentEditor";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getSiteContent, getSiteContentDrafts, getSiteContentRevisions } from "@/lib/supabase/site-content";

export const metadata: Metadata = {
  title: "Contenido del sitio",
  description: "Edición protegida de textos e imágenes institucionales.",
  robots: { index: false, follow: false },
};

export default async function ContentPage() {
  const { supabase, profile } = await requireAdmin();
  const [draftFields, publishedFields, revisions] = await Promise.all([
    getSiteContentDrafts(supabase),
    getSiteContent(),
    getSiteContentRevisions(supabase),
  ]);
  return (
    <ContentEditor
      draftFields={draftFields}
      publishedFields={publishedFields}
      revisions={revisions}
      canManageAccess={profile.role === "admin"}
    />
  );
}
