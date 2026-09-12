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
          y: 20, ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
        });
      }
    }, root);
    return () => media.revert();
  }, { scope: root });
  return <div ref={root} className={className}>{children}</div>;
}
