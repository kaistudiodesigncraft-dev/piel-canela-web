"use client";

import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MonthlySpecial,
  Treatment,
  TreatmentCategory,
} from "@/domain/treatment";
import { TreatmentDetailContent } from "./TreatmentDetailContent";

interface TreatmentDetailDialogProps {
  treatment: Treatment;
  category: TreatmentCategory;
  monthlySpecial?: MonthlySpecial;
  onClose: () => void;
}

export function TreatmentDetailDialog({
  treatment,
  category,
  monthlySpecial,
  onClose,
}: TreatmentDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || isClosing) return;

    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      dialog.close();
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => dialog.close(), 180);
  }, [isClosing]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      className={`treatment-dialog${isClosing ? " is-closing" : ""}`}
      ref={dialogRef}
      aria-label={`Detalle de ${treatment.name}`}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={onClose}
    >
      <div className="treatment-dialog__bar">
        <Link
          className="icon-text-link"
          href={`/tratamientos/${treatment.slug}${monthlySpecial ? `?monthlySpecial=${monthlySpecial.id}` : ""}`}
        >
          Abrir página
          <ExternalLink aria-hidden="true" strokeWidth={1.75} />
        </Link>
        <button
          className="icon-button"
          type="button"
          aria-label="Cerrar detalle"
          autoFocus
          onClick={requestClose}
        >
          <X aria-hidden="true" strokeWidth={1.75} />
        </button>
      </div>
      <TreatmentDetailContent
        treatment={treatment}
        category={category}
        monthlySpecial={monthlySpecial}
        compact
      />
    </dialog>
  );
}
