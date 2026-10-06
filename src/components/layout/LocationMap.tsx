import { ExternalLink } from "lucide-react";
import styles from "./LocationMap.module.css";

const EMBED_URL = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3405.548642773967!2d-64.1946483245992!3d-31.39900677426981!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94329863cd259ef5%3A0xf9a67064c67d0e03!2sEspacio%20O2%20-%20Sede%20Cofico!5e0!3m2!1ses-419!2sar!4v1791260469044!5m2!1ses-419!2sar";
const DIRECTIONS_URL = "https://www.google.com/maps/search/?api=1&query=Espacio%20O2%20Sede%20Cofico";

export function LocationMap() {
  return (
    <section className={styles.section} aria-labelledby="location-title">
      <div className={`site-container ${styles.layout}`}>
        <div className={styles.copy}>
          <p className="eyebrow">Ubicación</p>
          <h2 id="location-title">Encontranos en Espacio O2 Cofico.</h2>
          <p>Consultá el mapa para organizar tu llegada. La disponibilidad de cada tratamiento se elige desde el turnero.</p>
          <a className="text-link" href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer">
            Abrir indicaciones en Google Maps
            <ExternalLink aria-hidden="true" strokeWidth={1.75} />
            <span className="sr-only">(abre en otra pestaña)</span>
          </a>
        </div>
        <div className={styles.frame}>
          <iframe
            src={EMBED_URL}
            title="Mapa de Piel Canela en Espacio O2, sede Cofico"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  );
}
