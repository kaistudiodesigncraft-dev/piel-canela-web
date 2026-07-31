import { FIXTURE_NOTICE } from "@/data/fixtures";

export function FixtureNotice() {
  return (
    <aside className="fixture-notice" aria-label="Aviso sobre el contenido">
      <div className="site-container fixture-notice__inner">
        <strong>Muestra de implementación</strong>
        <span>{FIXTURE_NOTICE}</span>
      </div>
    </aside>
  );
}

