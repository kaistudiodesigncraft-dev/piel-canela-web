"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { setAdminPassword, type PasswordResult } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordResult, FormData>(setAdminPassword, { status: "idle", message: "" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  if (state.status === "saved") return <div role="status"><p>{state.message}</p><Link className="button button--primary" href="/admin">Entrar al panel</Link></div>;
  return <form action={action} className="admin-login-form" aria-busy={pending}>
    <label>Nueva contraseña<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    <label>Repetir contraseña<input name="passwordConfirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    {state.message && <p role="alert" className="form-message form-message--error">{state.message}</p>}
    <button className="button button--primary" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar contraseña"}</button>
    <Link href="/auth/recuperar">Solicitar un nuevo enlace</Link>
  </form>;
}
