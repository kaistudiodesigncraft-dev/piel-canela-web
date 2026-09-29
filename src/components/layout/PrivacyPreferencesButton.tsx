"use client";

export function PrivacyPreferencesButton() {
  return <button type="button" className="privacy-preferences-button" onClick={() => window.dispatchEvent(new Event("piel-canela:privacy-preferences"))}>Preferencias de privacidad</button>;
}
