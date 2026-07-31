import { StatePanel } from "@/components/ui/StatePanel";

export default function NotFound() {
  return (
    <div className="site-container route-state">
      <StatePanel
        kind="error"
        title="No encontramos esta página"
        description="El enlace puede estar incompleto o el contenido pudo haber cambiado."
        actionHref="/"
        actionLabel="Volver al inicio"
      />
    </div>
  );
}

