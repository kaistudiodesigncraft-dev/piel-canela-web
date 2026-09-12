"use client";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function RecoveryForm() {
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || cooldown) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    inFlight.current = true;
    setPending(true);
    setMessage("");
    try {
      // Supabase enforces server-side email/IP limits; the cooldown is UX only.
      // Fixed same-origin destination, never supplied by a query or form field.
      const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/complete?flow=recovery`,
      });
      if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
        setMessage("Esperá unos minutos antes de solicitar otro enlace.");
      } else {
        setMessage("Si el correo tiene una cuenta, recibirá un enlace para crear una nueva contraseña. Revisá también spam. Si no llega, contactá a Kai Studio.");
      }
      setCooldown(60);
    } catch {
      setMessage("No pudimos conectar. Revisá tu conexión e intentá nuevamente; el correo ingresado se conserva.");
    } finally { inFlight.current = false; setPending(false); }
  }
  return <form className="admin-login-form" onSubmit={submit} aria-busy={pending}>
    <label>Correo de tu cuenta<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <button className="button button--primary" type="submit" disabled={pending || cooldown > 0}>{pending ? "Solicitando enlace…" : cooldown ? `Volver a solicitar en ${cooldown} s` : "Enviar enlace de recuperación"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
