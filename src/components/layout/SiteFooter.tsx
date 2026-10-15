import Image from "next/image";
import Link from "next/link";
import { InstagramLogo, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { PrivacyPreferencesButton } from "./PrivacyPreferencesButton";
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
          <Image
            className="site-footer__logo"
            src="/brand/logo-white.webp"
            alt="Piel Canela, estética y bienestar"
            width={475}
            height={240}
          />
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
          {whatsapp || instagram ? (
            <ul className="site-footer__social-list" aria-label="Redes sociales y mensajería">
              {whatsapp ? (
                <li>
                  <a className="site-footer__social-link" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp de Piel Canela en otra pestaña" title="WhatsApp">
                    <WhatsappLogo aria-hidden="true" size={26} weight="regular" />
                    <span className="sr-only">WhatsApp</span>
                  </a>
                </li>
              ) : null}
              {instagram ? (
                <li>
                  <a className="site-footer__social-link" href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram de Piel Canela en otra pestaña" title="Instagram">
                    <InstagramLogo aria-hidden="true" size={26} weight="regular" />
                    <span className="sr-only">Instagram</span>
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
          {email ? <p><a href={email}>{settings.publicEmail}</a></p> : null}
          {!settings.address?.trim() && !whatsapp && !email && !instagram ? <p>Los datos de contacto se están actualizando.</p> : null}
        </div>
      </div>
      <div className="site-container site-footer__legal">
        <span>© {new Date().getFullYear()} Piel Canela</span>
        <span className="site-footer__legal-links"><Link href="/privacidad">Privacidad</Link><Link href="/cookies">Cookies</Link><Link href="/condiciones-de-reserva">Condiciones de reserva</Link></span>
        <span>Diseño y producto por WAZEXPERIENCE</span>
        <PrivacyPreferencesButton />
      </div>
    </footer>
  );
}
