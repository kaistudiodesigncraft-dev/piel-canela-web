"use client";

import { useSearchParams } from "next/navigation";
import type { MonthlySpecial, Treatment, TreatmentCategory } from "@/domain/treatment";
import { getMonthlySpecialForTreatment } from "@/lib/treatments";
import { TreatmentDetailContent } from "./TreatmentDetailContent";

interface TreatmentPageClientProps {
  treatment: Treatment;
  category: TreatmentCategory;
  monthlySpecials: readonly MonthlySpecial[];
}

export function TreatmentPageClient({
  treatment,
  category,
  monthlySpecials,
}: TreatmentPageClientProps) {
  const searchParams = useSearchParams();
  const monthlySpecial = getMonthlySpecialForTreatment(
    monthlySpecials,
    searchParams.get("monthlySpecial"),
    treatment.id,
  );

  return (
    <TreatmentDetailContent
      treatment={treatment}
      category={category}
      monthlySpecial={monthlySpecial}
    />
  );
}
