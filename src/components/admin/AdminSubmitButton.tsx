"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function AdminSubmitButton({
  children,
  pendingLabel,
  className = "button button--primary",
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-disabled={pending}>
    {pending ? pendingLabel : children}
  </button>;
}
