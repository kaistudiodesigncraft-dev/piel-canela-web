import {
  ExternalLink,
  ImageIcon,
  LockKeyhole,
  Save,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type {
  SiteContentField,
  SiteContentSection,
} from "@/domain/site-content";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import {
  lockContentEditor,
  saveSiteContentSection,
  unlockContentEditor,
} from "@/app/admin/contenido/actions";

const sectionDetails: Record<SiteContentSection, { title: string; description: string }> = {
  hero: {
    title: "Portada",
    description: "Mensaje e imagen que presentan Piel Canela al ingresar.",
  },
  categories: {
    title: "Entrada a tratamientos",
    description: "Encabezado que acompaña las tres categorías fijas.",
  },
  approach: {
    title: "Presentación del espacio",
    description: "Texto institucional sobre el enfoque y la relación con Espacio O2.",
  },
  booking: {
    title: "Cómo reservar",
    description: "Explicación breve del recorrido de pre-reserva.",
  },
  faq: {
    title: "Preguntas frecuentes",
    description: "Tres preguntas fijas con respuestas editables.",
  },
};

const sectionOrder = Object.keys(sectionDetails) as SiteContentSection[];

interface ContentEditorProps {
  fields: readonly SiteContentField[];
  canManageAccess: boolean;
  savedSection?: string;
  saveError?: string;
}

export function ContentEditor({ fields, canManageAccess, savedSection, saveError }: ContentEditorProps) {
  return (
    <div className="content-admin site-container">
      <header className="content-admin__header">
        <div>
          <p className="eyebrow">Contenido institucional</p>
          <h1>Editá la web sin alterar su estructura.</h1>
          <p>
            Los bloques, categorías y recorridos están protegidos. Acá solo se modifican textos e imágenes existentes.
          </p>
        </div>
        <div className="live-admin__actions">
          <Link className="button button--quiet" href="/" target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" strokeWidth={1.75} />
            Ver sitio
          </Link>
          <form action={lockContentEditor}>
            <button className="button button--quiet" type="submit">
              <LockKeyhole aria-hidden="true" strokeWidth={1.75} />
              Bloquear editor
            </button>
          </form>
        </div>
      </header>

      <AdminRouteNav current="content" canManageAccess={canManageAccess} />

      <nav className="content-admin__nav" aria-label="Secciones editables">
        {sectionOrder.map((section) => (
          <a key={section} href={`#${section}`}>{sectionDetails[section].title}</a>
        ))}
      </nav>

      {saveError ? (
        <p className="form-message form-message--error" role="alert">
          No se guardaron los cambios. Revisá los campos y la imagen e intentá nuevamente.
        </p>
      ) : null}

      <div className="content-admin__sections">
        {sectionOrder.map((section) => {
          const sectionFields = fields
            .filter((field) => field.section === section)
            .sort((left, right) => left.displayOrder - right.displayOrder);
          const details = sectionDetails[section];

          return (
            <section key={section} className="content-editor-section" id={section} aria-labelledby={`${section}-title`}>
              <div className="content-editor-section__heading">
                <div>
                  <h2 id={`${section}-title`}>{details.title}</h2>
                  <p>{details.description}</p>
                </div>
                {savedSection === section ? (
                  <span className="content-save-status" role="status">
                    <ShieldCheck aria-hidden="true" strokeWidth={1.75} /> Guardado
                  </span>
                ) : null}
              </div>

              <form action={saveSiteContentSection} className="content-editor-form">
                <input type="hidden" name="section" value={section} />
                {sectionFields.map((field) => {
                  if (field.kind === "image") {
                    return (
                      <div className="content-image-field" key={field.key}>
                        <div className="content-image-field__preview">
                          <Image
                            src={field.value}
                            alt={field.imageAlt ?? "Vista previa del contenido"}
                            fill
                            sizes="(max-width: 720px) 90vw, 360px"
                          />
                        </div>
                        <div className="content-image-field__controls">
                          <label className="content-field">
                            <span>{field.label}</span>
                            <span className="content-file-control">
                              <ImageIcon aria-hidden="true" strokeWidth={1.75} />
                              <input
                                type="file"
                                name={`${field.key}_file`}
                                accept="image/jpeg,image/png,image/webp,image/avif"
                              />
                            </span>
                            <small>JPG, PNG, WebP o AVIF. Máximo 8 MB. Si no elegís una imagen, se conserva la actual.</small>
                          </label>
                          <label className="content-field">
                            <span>Descripción accesible</span>
                            <input
                              type="text"
                              name={`${field.key}_alt`}
                              defaultValue={field.imageAlt ?? ""}
                              minLength={3}
                              maxLength={240}
                              required
                            />
                          </label>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <label className="content-field" key={field.key}>
                      <span>{field.label}</span>
                      {field.kind === "long_text" ? (
                        <textarea name={field.key} defaultValue={field.value} rows={4} maxLength={1400} required />
                      ) : (
                        <input type="text" name={field.key} defaultValue={field.value} maxLength={180} required />
                      )}
                    </label>
                  );
                })}
                <div className="content-editor-form__footer">
                  <p>Guardar actualiza esta sección completa y conserva todas las demás.</p>
                  <button className="button button--primary" type="submit">
                    <Save aria-hidden="true" strokeWidth={1.75} />
                    Guardar {details.title.toLowerCase()}
                  </button>
                </div>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface ContentEditorLockProps {
  configured: boolean;
  error?: string;
}

export function ContentEditorLock({ configured, error }: ContentEditorLockProps) {
  return (
    <section className="content-lock site-container" aria-labelledby="content-lock-title">
      <div className="content-lock__mark" aria-hidden="true">
        <LockKeyhole strokeWidth={1.75} />
      </div>
      <p className="eyebrow">Acceso de agencia</p>
      <h1 id="content-lock-title">Desbloqueá la edición de contenido.</h1>
      <p>
        Esta segunda verificación protege los textos e imágenes del sitio, incluso dentro de una sesión administrativa abierta.
      </p>

      {!configured ? (
        <p className="form-message form-message--error" role="alert">
          El código de agencia todavía no fue configurado en este entorno.
        </p>
      ) : (
        <form action={unlockContentEditor} className="content-lock__form">
          <label>
            Código único de desbloqueo
            <input
              type="password"
              name="unlockCode"
              autoComplete="off"
              minLength={6}
              maxLength={128}
              required
              aria-describedby="unlock-help"
            />
          </label>
          <p id="unlock-help">El acceso se bloquea automáticamente después de cuatro horas.</p>
          {error ? (
            <p className="form-message form-message--error" role="alert">
              {error === "expired" ? "El acceso venció. Ingresá nuevamente el código." : "El código ingresado no es válido."}
            </p>
          ) : null}
          <button className="button button--primary" type="submit">
            <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
            Desbloquear editor
          </button>
        </form>
      )}

      <Link className="text-link" href="/admin">Volver al panel</Link>
    </section>
  );
}
