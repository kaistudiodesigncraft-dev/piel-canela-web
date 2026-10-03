"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Progressive enhancement: content remains visible without JS or motion. */
export function HomeMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
      const hero = root.current?.querySelector("[data-hero]");
      const visual = root.current?.querySelector("[data-hero-visual]");
      if (hero && visual) {
        gsap.to(visual, {
          y: 18, ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
        });
      }
      gsap.utils.toArray<HTMLElement>(".section").forEach((section) => {
        gsap.fromTo(section, { y: 14 }, {
          y: 0,
          duration: 0.72,
          ease: "power3.out",
          scrollTrigger: { trigger: section, start: "top 88%", once: true },
        });
      });
      const categoryEntries = gsap.utils.toArray<HTMLElement>(".category-entry");
      if (categoryEntries.length > 0) {
        gsap.fromTo(categoryEntries, { y: 12, scale: 0.99 }, {
          y: 0,
          scale: 1,
          duration: 0.56,
          stagger: 0.07,
          ease: "power3.out",
          scrollTrigger: { trigger: ".category-entry-grid", start: "top 86%", once: true },
        });
      }
    }, root);
    return () => media.revert();
  }, { scope: root });
  return <div ref={root} className={className}>{children}</div>;
}
