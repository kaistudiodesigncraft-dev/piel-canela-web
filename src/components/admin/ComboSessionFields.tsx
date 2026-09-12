"use client";

import { useState } from "react";

export function ComboSessionFields({ initialMode, sessionCount, validityDays }: {
  initialMode: "single_session" | "package";
  sessionCount: number;
  validityDays: number | null;
}) {
  const [mode, setMode] = useState(initialMode);
  return <div className="admin-form-grid admin-form-grid--3">
    <label>Modalidad<select name="mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
      <option value="single_session">Una sesión</option>
      <option value="package">Paquete de sesiones</option>
    </select></label>
    <label hidden={mode !== "package"} style={mode !== "package" ? { display: "none" } : undefined}>Cantidad de sesiones<input name="sessionCount" type="number" min="2" max="48" defaultValue={sessionCount > 1 ? sessionCount : 2} disabled={mode !== "package"} required={mode === "package"} /></label>
    <label hidden={mode !== "package"} style={mode !== "package" ? { display: "none" } : undefined}>Vigencia en días<input name="validityDays" type="number" min="1" max="730" defaultValue={validityDays ?? 90} disabled={mode !== "package"} required={mode === "package"} /></label>
  </div>;
}
