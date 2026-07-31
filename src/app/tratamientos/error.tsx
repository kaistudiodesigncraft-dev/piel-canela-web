"use client";

import { StatePanel } from "@/components/ui/StatePanel";

export default function TreatmentsError() {
  return (
    <div className="site-container route-state">
      <StatePanel
        kind="error"
        title="No pudimos cargar los tratamientos"
        description="Volvé a intentar o regresá al inicio."
        actionHref="/tratamientos"
        actionLabel="Reintentar"
      />
    </div>
  );
}

