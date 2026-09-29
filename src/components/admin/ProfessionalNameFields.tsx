"use client";
import { useState } from "react";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");

export function ProfessionalNameFields({ fullName = "", publicName = "", existingNames = [] }: {
  fullName?: string; publicName?: string; existingNames?: string[];
}) {
  const [internal, setInternal] = useState(fullName);
  const [external, setExternal] = useState(publicName);
  const duplicate = [internal, external].some((name) => normalize(name).length > 1 && existingNames.some((existing) => normalize(existing) === normalize(name)));
  return <>
    <label>Nombre interno<input name="fullName" value={internal} onChange={(event) => setInternal(event.target.value)} minLength={2} maxLength={100} required /></label>
    <label>Nombre público opcional<input name="publicName" value={external} onChange={(event) => setExternal(event.target.value)} maxLength={100} /></label>
    {duplicate ? <p className="admin-field-note" role="status">Ya hay un perfil con este nombre. Si es la misma persona, agregá sus especialidades al perfil existente para no dividir su agenda. Si son personas diferentes, podés continuar. No se fusionará ningún perfil automáticamente.</p> : null}
  </>;
}
