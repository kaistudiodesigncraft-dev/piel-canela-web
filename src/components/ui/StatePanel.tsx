import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import Link from "next/link";

type StateKind = "empty" | "error" | "loading" | "unavailable";

interface StatePanelProps {
  kind: StateKind;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function StatePanel({
  kind,
  title,
  description,
  actionHref,
  actionLabel,
}: StatePanelProps) {
  const Icon = kind === "loading" ? LoaderCircle : kind === "empty" ? Inbox : AlertCircle;

  return (
    <section className={`state-panel state-panel--${kind}`} aria-live={kind === "error" ? "assertive" : "polite"}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      <h2>{title}</h2>
      <p>{description}</p>
      {actionHref && actionLabel ? (
        <Link className="button button--secondary" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}

