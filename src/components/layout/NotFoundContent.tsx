import Link from "next/link";
import styles from "./PublicInformation.module.css";

export function NotFoundContent() {
  return (
    <section className={`site-container ${styles.error}`} aria-labelledby="not-found-heading">
      <p className={styles.errorCode}>Error 404</p>
      <h1 id="not-found-heading">Esta página no está disponible</h1>
      <p>El enlace puede estar incompleto o el contenido haber cambiado. Podés volver al inicio o explorar los tratamientos disponibles.</p>
      <div className={styles.errorActions}>
        <Link className="button button--primary" href="/tratamientos">Ver tratamientos</Link>
        <Link className="button button--secondary" href="/">Volver al inicio</Link>
      </div>
    </section>
  );
}
