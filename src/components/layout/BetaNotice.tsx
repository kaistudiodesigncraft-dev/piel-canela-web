import { isBetaRelease } from "../../../scripts/release-environment.mjs";

export function BetaNotice() {
  if (!isBetaRelease()) return null;

  return (
    <aside className="beta-notice" aria-label="Estado de esta versión">
      <div className="site-container beta-notice__inner">
        <strong>Versión beta</strong>
        <span>
          Piel Canela está cargando y validando tratamientos. Confirmá por
          WhatsApp antes de considerar definitivo un turno.
        </span>
      </div>
    </aside>
  );
}
