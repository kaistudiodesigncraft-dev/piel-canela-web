"use client";

import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      className="treatment-dialog"
      ref={dialogRef}
      aria-label={`Detalle de ${treatment.name}`}
      onCancel={(event) => {
        event.preventDefault();
        dialogRef.current?.close();
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
          onClick={() => dialogRef.current?.close()}
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
