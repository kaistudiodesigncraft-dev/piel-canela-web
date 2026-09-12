import Link from "next/link";
import { publicEmailLink, publicInstagramLink, publicWhatsAppLink } from "./public-contact";
import styles from "./PublicInformation.module.css";

interface SiteFooterProps {
  hasMonthlySpecials?: boolean;
  settings: {
    whatsappNumber: string | null;
    address: string | null;
    publicEmail: string | null;
    instagramUrl: string | null;
    depositText: string | null;
    cancellationPolicy: string | null;
    receptionHours?: string | null;
  };
}

export function SiteFooter({ settings, hasMonthlySpecials = false }: SiteFooterProps) {
  const whatsapp = publicWhatsAppLink(settings.whatsappNumber);
  const email = publicEmailLink(settings.publicEmail);
  const instagram = publicInstagramLink(settings.instagramUrl);
  return (
    <footer className={`site-footer ${styles.footer}`} id="contacto">
      <div className="site-container site-footer__grid">
        <div>
          <p className="wordmark wordmark--footer">
            <span className="wordmark__main">Piel Canela</span>
            <span className="wordmark__sub">bienestar y cuidado</span>
          </p>
          <p className="site-footer__intro">
            Un espacio para elegir cuidados con información clara y atención profesional.
          </p>
        </div>
        <div>
          <h2 className="site-footer__title">Explorá</h2>
          <ul className="site-footer__links">
            <li><Link href="/tratamientos">Tratamientos</Link></li>
            {hasMonthlySpecials ? <li><Link href="/#especiales">Especiales del mes</Link></li> : null}
            <li><Link href="/reservar">Reservar</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="site-footer__title">Encontranos</h2>
          {settings.address?.trim() ? <address className={styles.address}>{settings.address}</address> : null}
          {settings.receptionHours?.trim() ? <div className={styles.address}><h3 className="site-footer__title">Horarios de recepción</h3><p>{settings.receptionHours}</p><p>La disponibilidad de turnos se consulta por tratamiento.</p></div> : null}
          {whatsapp ? <p><a href={whatsapp}>WhatsApp {settings.whatsappNumber}</a></p> : null}
          {email ? <p><a href={email}>{settings.publicEmail}</a></p> : null}
          {instagram ? <p><a href={instagram} target="_blank" rel="noopener noreferrer">Instagram <span className="sr-only">(abre en otra pestaña)</span></a></p> : null}
          {!settings.address?.trim() && !whatsapp && !email && !instagram ? <p>Los datos de contacto se están actualizando.</p> : null}
        </div>
      </div>
      <div className="site-container site-footer__legal">
        <span>© {new Date().getFullYear()} Piel Canela</span>
        <span className="site-footer__legal-links"><Link href="/privacidad">Privacidad</Link><Link href="/condiciones-de-reserva">Condiciones de reserva</Link></span>
        <span>Diseño y producto por Kai Studio</span>
      </div>
    </footer>
  );
}
