"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "piel-canela-cookie-consent";

type ConsentValue = "essential" | "analytics";

function readConsent(): ConsentValue | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "essential" || value === "analytics" ? value : null;
  } catch {
    return null;
  }
}

function writeConsent(value: ConsentValue) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // If storage is unavailable, keep the in-memory choice for this render only.
  }
}

export function ConsentManagedInsights() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const reopen = () => setEditing(true);
    window.addEventListener("piel-canela:privacy-preferences", reopen);
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setConsent(readConsent());
      setReady(true);
    });
    return () => {
      cancelled = true;
      window.removeEventListener("piel-canela:privacy-preferences", reopen);
    };
  }, []);

  const acceptAnalytics = () => {
    writeConsent("analytics");
    setConsent("analytics");
    setEditing(false);
  };
  const acceptEssential = () => {
    writeConsent("essential");
    setConsent("essential");
    setEditing(false);
  };

  return (
    <>
      {consent === "analytics" ? <><Analytics /><SpeedInsights /></> : null}
      {ready && (consent === null || editing) ? (
        <aside className="cookie-consent" aria-label="Preferencias de privacidad y medición">
          <div>
            <strong>Privacidad y medición</strong>
            <p>Usamos cookies técnicas para la sesión del panel. La medición de navegación y rendimiento se activa solo si la aceptás.</p>
            <Link href="/cookies">Ver política de cookies</Link>
          </div>
          <div className="cookie-consent__actions">
            <button className="button button--quiet" type="button" onClick={acceptEssential}>Solo necesarias</button>
            <button className="button button--primary" type="button" onClick={acceptAnalytics}>Aceptar medición</button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
