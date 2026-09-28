import Link from "next/link";
import styles from "./PublicInformation.module.css";

export function NotFoundContent() {
  return (
    <section className={`site-container ${styles.error}`} aria-labelledby="not-found-heading">
      <p className={styles.errorCode}>Error 404</p>
      <h1 id="not-found-heading">Esta página no está disponible</h1>
      <p>El enlace puede estar incompleto, el tratamiento pudo haber cambiado de dirección o el contenido ya no está publicado. Podés volver al inicio, explorar tratamientos o comenzar una nueva pre-reserva.</p>
      <div className={styles.errorActions}>
        <Link className="button button--primary" href="/tratamientos">Ver tratamientos</Link>
        <Link className="button button--quiet" href="/reservar">Reservar</Link>
        <Link className="button button--secondary" href="/">Volver al inicio</Link>
      </div>
    </section>
  );
}
