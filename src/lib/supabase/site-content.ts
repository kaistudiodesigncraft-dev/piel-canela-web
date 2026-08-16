import {
  getDefaultSiteContent,
  isSiteContentKey,
  type SiteContentField,
  type SiteContentKind,
  type SiteContentSection,
} from "@/domain/site-content";
import { usesSupabaseDataSource } from "./env";
import { createSupabasePublicServerClient } from "./public-server";

interface SiteContentRow {
  key: string;
  section: SiteContentSection;
  label: string;
  kind: SiteContentKind;
  value: string;
  image_path: string | null;
  image_alt: string | null;
  display_order: number;
  updated_at: string;
}

export async function getSiteContent(): Promise<SiteContentField[]> {
  if (!usesSupabaseDataSource()) return getDefaultSiteContent();

  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase
    .from("site_content")
    .select("key,section,label,kind,value,image_path,image_alt,display_order,updated_at")
    .order("section")
    .order("display_order");

  if (error) throw new Error(`No se pudo cargar el contenido del sitio: ${error.message}`);

  const rows = (data as SiteContentRow[]).filter((row) => isSiteContentKey(row.key));
  const stored = new Map(rows.map((row) => [row.key, row]));

  return getDefaultSiteContent().map((fallback) => {
    const row = stored.get(fallback.key);
    if (!row) return fallback;

    let value = row.value;
    if (row.kind === "image" && row.image_path) {
      value = supabase.storage.from("site-content-media").getPublicUrl(row.image_path).data.publicUrl;
    }

    return {
      key: fallback.key,
      section: row.section,
      label: row.label,
      kind: row.kind,
      value,
      imagePath: row.image_path,
      imageAlt: row.image_alt,
      displayOrder: row.display_order,
      updatedAt: row.updated_at,
    };
  });
}
