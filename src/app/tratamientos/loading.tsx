import { StatePanel } from "@/components/ui/StatePanel";

export default function TreatmentsLoading() {
  return (
    <div className="site-container route-state">
      <StatePanel
        kind="loading"
        title="Preparando los tratamientos"
        description="Estamos ordenando la información del catálogo."
      />
    </div>
  );
}

