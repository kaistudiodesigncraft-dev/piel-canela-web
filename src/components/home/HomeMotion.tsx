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
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const logo = root.current?.querySelector<HTMLImageElement>("[data-hero-logo]");
      const hero = root.current?.querySelector<HTMLElement>("[data-hero]");
      const copy = root.current?.querySelector<HTMLElement>("[data-hero-copy]");
      const intro = root.current?.querySelector<HTMLElement>("[data-hero-intro]");
      const shade = root.current?.querySelector<HTMLElement>("[data-hero-shade]");
      const background = root.current?.querySelector<HTMLElement>("[data-hero-background]");
      if (!logo || !hero || !copy || !intro || !background || !shade) return;
      let active = true;
      // Wait for the original assets to decode; do not animate an empty image.
      const entrance = gsap.timeline({ paused: true });
      gsap.set(copy, { opacity: 0, y: 12 });
      gsap.set(intro, { opacity: 1 });
      gsap.set(shade, { opacity: 0 });
      entrance.fromTo(logo,
        { opacity: 0, scale: .96, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: .7, ease: "power3.out" }, .15)
        .to(logo, { opacity: 0, scale: .98, duration: .45, ease: "power2.inOut" }, 1.3)
        .to(intro, { opacity: 0, duration: .7, ease: "power2.inOut" }, 1.3)
        .to(shade, { opacity: .64, duration: .5, ease: "power2.inOut" }, 1.3)
        .to(copy, { opacity: 1, y: 0, duration: .65, ease: "power3.out", clearProps: "transform,opacity" }, 1.65);

      gsap.to(background, {
        y: 28, ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });
      // Keyboard access or early scrolling should never have to wait for the introduction.
      const finishIntroduction = () => { entrance.progress(1).pause(); };
      const onScroll = () => {
        if (hero.getBoundingClientRect().top < -64) finishIntroduction();
      };
      copy.addEventListener("focusin", finishIntroduction);
      window.addEventListener("scroll", onScroll, { passive: true });
      const images = root.current?.querySelectorAll<HTMLImageElement>("[data-hero] img") ?? [];
      void Promise.allSettled(Array.from(images, (image) => image.decode())).then(() => {
        if (active && entrance.progress() < 1) entrance.play();
      });
      return () => {
        active = false;
        copy.removeEventListener("focusin", finishIntroduction);
        window.removeEventListener("scroll", onScroll);
      };
    }, root);
    media.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
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
