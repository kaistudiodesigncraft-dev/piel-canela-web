import type { Metadata } from "next";
import { ContentEditor, ContentEditorLock } from "@/components/admin/ContentEditor";
import {
  hasAgencyUnlockSession,
  isAgencyUnlockConfigured,
} from "@/lib/admin/agency-unlock";
import { requireOwner } from "@/lib/admin/require-admin";
import { getSiteContent } from "@/lib/supabase/site-content";

export const metadata: Metadata = {
  title: "Contenido del sitio",
  description: "Edición protegida de textos e imágenes institucionales.",
  robots: { index: false, follow: false },
};

interface ContentPageProps {
  searchParams: Promise<{
    unlocked?: string;
    unlockError?: string;
    saved?: string;
    saveError?: string;
  }>;
}

export default async function ContentPage({ searchParams }: ContentPageProps) {
  const { userId, profile } = await requireOwner();
  const query = await searchParams;
  const unlocked = await hasAgencyUnlockSession(userId);

  if (!unlocked) {
    return (
      <ContentEditorLock
        configured={isAgencyUnlockConfigured()}
        error={query.unlockError}
      />
    );
  }

  const fields = await getSiteContent();
  return (
    <ContentEditor
      fields={fields}
      canManageAccess={profile.role === "admin"}
      savedSection={query.saved}
      saveError={query.saveError}
    />
  );
}
