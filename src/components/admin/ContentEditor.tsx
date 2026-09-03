import { ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { SiteContentField, SiteContentSection } from "@/domain/site-content";
import type { SiteContentRevisionSummary } from "@/lib/supabase/site-content";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { ContentSectionEditor } from "@/components/admin/ContentSectionEditor";

const sectionDetails: Record<SiteContentSection, { title: string; description: string }> = {
  hero: { title: "Portada", description: "Mensaje e imagen que presentan Piel Canela al ingresar." },
  categories: { title: "Entrada a tratamientos", description: "Encabezado y fondo de las tres categorías fijas." },
  specials: { title: "Especiales del mes", description: "Presentación visual de las propuestas temporales cargadas desde Operación." },
  approach: { title: "Presentación del espacio", description: "Relato institucional y fondo sobre el enfoque de Piel Canela." },
  booking: { title: "Cómo reservar", description: "Explicación fija del recorrido de pre-reserva." },
  faq: { title: "Preguntas frecuentes", description: "Tres preguntas fijas, sus respuestas y el fondo de la sección." },
  catalog_header: { title: "Cabecera del catálogo", description: "Introducción e imagen de la página de tratamientos." },
  booking_header: { title: "Cabecera del turnero", description: "Introducción e imagen del proceso de reserva." },
};

const sectionOrder = Object.keys(sectionDetails) as SiteContentSection[];

export function ContentEditor({
  draftFields,
  publishedFields,
  revisions,
  canManageAccess,
}: {
  draftFields: readonly SiteContentField[];
  publishedFields: readonly SiteContentField[];
  revisions: readonly SiteContentRevisionSummary[];
  canManageAccess: boolean;
}) {
  return (
    <div className="content-admin site-container">
      <header className="content-admin__header">
        <div>
          <p className="eyebrow">Contenido del sitio</p>
          <h1>Editá textos e imágenes sin alterar la estructura.</h1>
          <p>
            Guardá un borrador, revisalo en mobile y escritorio y publicalo cuando esté listo. Las secciones, el orden, la tipografía y los colores permanecen protegidos.
          </p>
        </div>
        <Link className="button button--quiet" href="/" target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden="true" strokeWidth={1.75} />
          Ver sitio publicado
        </Link>
      </header>

      <AdminRouteNav current="content" canManageAccess={canManageAccess} />

      <div className="content-editor-boundary" role="note">
        <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
        <p><strong>Edición controlada.</strong> No se pueden crear, borrar, ocultar o reordenar secciones, ni agregar HTML, CSS o enlaces externos.</p>
      </div>

      <nav className="content-admin__nav" aria-label="Secciones editables">
        {sectionOrder.map((section) => <a key={section} href={`#${section}`}>{sectionDetails[section].title}</a>)}
      </nav>

      <div className="content-admin__sections">
        {sectionOrder.map((section) => {
          const details = sectionDetails[section];
          const fields = draftFields.filter((field) => field.section === section).sort((a, b) => a.displayOrder - b.displayOrder);
          const published = publishedFields.filter((field) => field.section === section).sort((a, b) => a.displayOrder - b.displayOrder);
          return (
            <ContentSectionEditor
              key={`${section}-${fields.map((field) => field.updatedAt ?? "default").join("-")}`}
              section={section}
              title={details.title}
              description={details.description}
              fields={fields}
              publishedFields={published}
              revisions={revisions.filter((revision) => revision.section === section)}
            />
          );
        })}
      </div>
    </div>
  );
}
