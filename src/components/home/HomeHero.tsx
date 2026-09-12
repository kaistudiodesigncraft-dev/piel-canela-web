import { ArrowRight, Check, MessageCircleMore } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { SiteContentField } from "@/domain/site-content";
import styles from "./HomeHero.module.css";

interface HomeHeroProps {
  eyebrow: string;
  title: string;
  lead: string;
  caption: string;
  image?: SiteContentField;
}

export function HomeHero({ eyebrow, title, lead, caption, image }: HomeHeroProps) {
  const showImage = image?.settings.enabled !== false;

  return (
    <section className={styles.hero} aria-labelledby="home-title" data-hero>
      <div className={`site-container ${styles.grid}`} data-with-image={showImage}>
        <div className={styles.copy}>
          {eyebrow && <p className={styles.introduction}>{eyebrow}</p>}
          <h1 id="home-title" className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          <div className={`button-row ${styles.actions}`}>
            <Link className="button button--primary" href="/tratamientos">
              Explorar tratamientos
              <ArrowRight aria-hidden="true" strokeWidth={1.75} />
            </Link>
            <Link className="button button--quiet" href="/#contacto">
              <MessageCircleMore aria-hidden="true" strokeWidth={1.75} />
              Consultar
            </Link>
          </div>
          <ul className={styles.assurances} aria-label="Información importante">
            <li><Check aria-hidden="true" strokeWidth={1.75} />Precios y duración visibles</li>
            <li><Check aria-hidden="true" strokeWidth={1.75} />Pre-reserva sin crear una cuenta</li>
          </ul>
        </div>
        {showImage && (
          <figure className={styles.visual}>
            <div className={styles.imageFrame} data-surface={image?.settings.surfacePreset ?? "plain"}>
              <div className={styles.imageMotion} data-hero-visual>
                <Image
                  src={image?.value || "/images/treatment-massage-concept.png"}
                  alt={image?.imageAlt ?? "Imagen principal de Piel Canela"}
                  fill
                  priority
                  sizes="(max-width: 767px) 92vw, (max-width: 1279px) 46vw, 590px"
                  style={{ objectPosition: `${image?.settings.focalX ?? 38}% ${image?.settings.focalY ?? 50}%` }}
                />
              </div>
              <span className={styles.overlay} data-level={image?.settings.overlayPreset ?? "none"} aria-hidden="true" />
              <div className={styles.atmosphere} data-atmosphere aria-hidden="true" />
            </div>
            {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
          </figure>
        )}
      </div>
    </section>
  );
}
