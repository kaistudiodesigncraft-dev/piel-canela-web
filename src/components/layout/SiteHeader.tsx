import Link from "next/link";

const navigation = [
  { href: "/", label: "Inicio" },
  { href: "/tratamientos", label: "Tratamientos" },
  { href: "/#piel-canela", label: "Piel Canela" },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container site-header__inner">
        <Link className="wordmark" href="/" aria-label="Piel Canela, inicio">
          <span className="wordmark__main">Piel Canela</span>
          <span className="wordmark__sub">bienestar y cuidado</span>
        </Link>

        <nav className="site-nav" aria-label="Navegación principal">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="site-nav__link">
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="button button--primary site-header__cta" href="/tratamientos#catalogo">
          Reservar
        </Link>
      </div>
    </header>
  );
}
