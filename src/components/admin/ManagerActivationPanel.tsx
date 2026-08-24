"use client";

import { Download, QrCode, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  generateManagerActivation,
  initialManagerActivationState,
  type ManagerActivationState,
} from "@/app/admin/seguridad/activation-actions";

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--primary" type="submit" disabled={pending} aria-disabled={pending}>
      <QrCode aria-hidden="true" strokeWidth={1.75} />
      {pending ? "Generando acceso…" : "Generar QR de activación"}
    </button>
  );
}

function activationError(state: ManagerActivationState) {
  if (state.error === "configuration") return "La activación QR todavía no está habilitada en este entorno.";
  if (state.error === "protected") return "Ese correo pertenece a una cuenta propietaria y no puede convertirse en gestión del cliente.";
  if (state.error === "profile") return "La identidad se generó, pero no pudimos asignar el permiso. No compartas ningún QR e intentá nuevamente.";
  if (state.error === "generation") return "No pudimos generar un acceso seguro. Esperá unos segundos e intentá nuevamente.";
  if (state.error === "invalid") return "Revisá los datos indicados antes de generar el acceso.";
  return null;
}

export function ManagerActivationPanel({
  initialState = initialManagerActivationState,
}: {
  initialState?: ManagerActivationState;
}) {
  const [state, formAction] = useActionState(generateManagerActivation, initialState);
  const errorMessage = activationError(state);

  return (
    <section className="live-admin__section admin-activation" id="activacion" aria-labelledby="activation-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="activation-title">Activación presencial por QR</h2>
          <p>Creá un acceso de un solo uso para la persona responsable de Piel Canela. Supabase genera el enlace, pero no envía ningún correo.</p>
        </div>
        <span className="status-badge status-pending">Solo Kai Studio</span>
      </div>

      <div className="admin-activation-layout">
        <form action={formAction} className="admin-form admin-activation-form" aria-describedby="activation-security-note">
          {errorMessage ? <p className="form-message form-message--error" role="alert">{errorMessage}</p> : null}
          <label htmlFor="activation-full-name">
            Nombre visible
            <input id="activation-full-name" name="fullName" minLength={2} maxLength={100} defaultValue="Piel Canela" required aria-invalid={Boolean(state.fieldErrors?.fullName) || undefined} aria-describedby={state.fieldErrors?.fullName ? "activation-full-name-error" : undefined} />
            {state.fieldErrors?.fullName ? <small id="activation-full-name-error" className="admin-field-error">{state.fieldErrors.fullName}</small> : null}
          </label>
          <label htmlFor="activation-email">
            Correo de la persona responsable
            <input id="activation-email" name="email" type="email" autoComplete="off" maxLength={180} required aria-invalid={Boolean(state.fieldErrors?.email) || undefined} aria-describedby={state.fieldErrors?.email ? "activation-email-error" : undefined} />
            {state.fieldErrors?.email ? <small id="activation-email-error" className="admin-field-error">{state.fieldErrors.email}</small> : null}
          </label>
          <p id="activation-security-note" className="admin-access-note"><ShieldCheck aria-hidden="true" strokeWidth={1.75} />Mostrá el QR únicamente a la persona autorizada. Se invalida después del primer uso o al vencer.</p>
          <GenerateButton />
        </form>

        <div className={`admin-activation-result${state.status === "ready" ? " is-ready" : ""}`} aria-live="polite">
          {state.status === "ready" && state.qrDataUrl ? (
            <>
              <div className="admin-activation-qr">
                <Image src={state.qrDataUrl} alt="Código QR de activación administrativa de un solo uso" width={360} height={360} />
              </div>
              <div>
                <strong>QR listo para mostrar</strong>
                <p>Generado para {state.generatedFor}. {state.activationKind === "recovery" ? "Crea un nuevo acceso para una identidad existente." : "Crea una cuenta de gestión del cliente."}</p>
                <p>La persona debe escanearlo, crear su contraseña y entrar al panel desde su propio dispositivo.</p>
              </div>
              <a className="button button--quiet" href={state.qrDataUrl} download="activacion-piel-canela.png"><Download aria-hidden="true" strokeWidth={1.75} />Descargar QR</a>
            </>
          ) : (
            <div className="admin-activation-placeholder">
              <QrCode aria-hidden="true" strokeWidth={1.75} />
              <strong>El QR aparecerá acá</strong>
              <p>No se guarda en la URL, no se incluye en los logs y no se envía por email.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
