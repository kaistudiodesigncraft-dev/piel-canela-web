import Link from "next/link";

export function SiteFooter() {
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
          <p>Dentro de Espacio O2</p>
          <p>Dirección y WhatsApp pendientes de confirmación.</p>
        </div>
      </div>
      <div className="site-container site-footer__legal">
        <span>© 2026 Piel Canela</span>
        <span>Diseño y producto por Kai Studio</span>
      </div>
    </footer>
  );
}
