import Link from "next/link";

interface SiteFooterProps {
  settings: {
    whatsappNumber: string | null;
    address: string | null;
    publicEmail: string | null;
    instagramUrl: string | null;
    depositText: string | null;
    cancellationPolicy: string | null;
  };
}

export function SiteFooter({ settings }: SiteFooterProps) {
  return (
    <footer className="site-footer" id="contacto">
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
            <li><Link href="/#especiales">Especiales del mes</Link></li>
            <li><Link href="/reservar">Reservar</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="site-footer__title">Encontranos</h2>
          <p>{settings.address ?? "Dentro de Espacio O2"}</p>
          {settings.whatsappNumber ? <p><a href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`}>WhatsApp {settings.whatsappNumber}</a></p> : null}
          {settings.publicEmail ? <p><a href={`mailto:${settings.publicEmail}`}>{settings.publicEmail}</a></p> : null}
          {settings.instagramUrl ? <p><a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a></p> : null}
        </div>
      </div>
      <div className="site-container site-footer__legal">
        <span>© 2026 Piel Canela</span>
        <span className="site-footer__legal-links"><Link href="/privacidad">Privacidad</Link><Link href="/condiciones-de-reserva">Condiciones de reserva</Link></span>
        <span>Diseño y producto por Kai Studio</span>
      </div>
    </footer>
  );
}
