import {
  getDefaultSiteContent,
  isSiteContentKey,
  type SiteContentField,
  type SiteContentKind,
  type SiteContentOverlayPreset,
  type SiteContentPresentation,
  type SiteContentSection,
  type SiteContentSurfacePreset,
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
  focal_x: number;
  focal_y: number;
  presentation: SiteContentPresentation;
  surface_preset: SiteContentSurfacePreset;
  overlay_preset: SiteContentOverlayPreset;
  enabled: boolean;
  updated_at: string;
}

export interface SiteContentRevisionSummary {
  id: string;
  section: SiteContentSection;
  reason: "publish" | "restore";
  createdAt: string;
}

type SiteContentQueryClient = ReturnType<typeof createSupabasePublicServerClient>;

function resolveRows(rows: readonly SiteContentRow[], supabase: SiteContentQueryClient) {
  const stored = new Map(rows.filter((row) => isSiteContentKey(row.key)).map((row) => [row.key, row]));

  return getDefaultSiteContent().map((fallback) => {
    const row = stored.get(fallback.key);
    if (!row) return fallback;

    let value = row.value;
    if (row.kind === "image" && row.image_path) {
      value = row.image_path.startsWith("/")
        ? row.image_path
        : supabase.storage.from("site-content-media").getPublicUrl(row.image_path).data.publicUrl;
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
      settings: {
        focalX: row.focal_x,
        focalY: row.focal_y,
        presentation: row.presentation,
        surfacePreset: row.surface_preset,
        overlayPreset: row.overlay_preset,
        enabled: row.enabled,
      },
    };
  });
}

export async function getSiteContent(): Promise<SiteContentField[]> {
  if (!usesSupabaseDataSource()) return getDefaultSiteContent();

  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase
    .from("site_content")
    .select("key,section,label,kind,value,image_path,image_alt,display_order,focal_x,focal_y,presentation,surface_preset,overlay_preset,enabled,updated_at")
    .order("section")
    .order("display_order");

  if (error) throw new Error(`No se pudo cargar el contenido del sitio: ${error.message}`);

  return resolveRows(data as SiteContentRow[], supabase);
}

export async function getSiteContentDrafts(
  supabase: SiteContentQueryClient,
): Promise<SiteContentField[]> {
  const { data, error } = await supabase
    .from("site_content_drafts")
    .select("key,section,label,kind,value,image_path,image_alt,display_order,focal_x,focal_y,presentation,surface_preset,overlay_preset,enabled,updated_at")
    .order("section")
    .order("display_order");
  if (error) throw new Error(`No se pudieron cargar los borradores: ${error.message}`);
  return resolveRows(data as SiteContentRow[], supabase);
}

export async function getSiteContentRevisions(
  supabase: SiteContentQueryClient,
): Promise<SiteContentRevisionSummary[]> {
  const { data, error } = await supabase
    .from("site_content_revisions")
    .select("id,section,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`No se pudo cargar el historial de contenido: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    section: row.section as SiteContentSection,
    reason: row.reason as "publish" | "restore",
    createdAt: row.created_at,
  }));
}
