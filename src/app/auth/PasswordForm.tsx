"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { setAdminPassword, type PasswordResult } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordResult, FormData>(setAdminPassword, { status: "idle", message: "" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  if (state.status === "saved") return <div role="status"><p>{state.message}</p><Link className="button button--primary" href="/admin">Entrar al panel</Link></div>;
  return <form action={action} className="admin-login-form" aria-busy={pending}>
    <p id="password-requirements">Usá entre 12 y 128 caracteres. Elegí una contraseña única, que no uses en otras cuentas.</p>
    <label>Nueva contraseña<input name="password" type={visible ? "text" : "password"} aria-describedby="password-requirements" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    <label>Repetir contraseña<input name="passwordConfirmation" type={visible ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    <button type="button" className="button button--quiet" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Ocultar contraseñas" : "Mostrar contraseñas"}</button>
    {state.message && <p role="alert" className="form-message form-message--error">{state.message}</p>}
    <button className="button button--primary" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar contraseña"}</button>
    <Link href="/auth/recuperar">Solicitar un nuevo enlace</Link>
  </form>;
}
