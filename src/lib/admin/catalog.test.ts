import { describe, expect, it } from "vitest";
import {
  focalPointToPercentage,
  getTreatmentPublicationState,
  linesToAdminText,
  percentageToFocalPoint,
  splitAdminLines,
} from "./catalog";

describe("admin catalog helpers", () => {
  it("normalizes structured list fields without empty entries", () => {
    expect(splitAdminLines("Evaluación inicial\n\n Cuidado personalizado \nRutina posterior\nExtra", 3))
      .toEqual(["Evaluación inicial", "Cuidado personalizado", "Rutina posterior"]);
    expect(linesToAdminText(["Uno", "Dos"])).toBe("Uno\nDos");
  });

  it("converts focal points between UI percentages and database decimals", () => {
    expect(percentageToFocalPoint(43)).toBe(0.43);
    expect(focalPointToPercentage("0.675")).toBe(68);
  });

  it("distinguishes draft, ready and published treatments", () => {
    expect(getTreatmentPublicationState({ isActive: false, imagePath: null, imageAlt: null })).toBe("draft");
    expect(getTreatmentPublicationState({ isActive: false, imagePath: "treatments/a.webp", imageAlt: "Cabina" })).toBe("ready");
    expect(getTreatmentPublicationState({ isActive: true, imagePath: "treatments/a.webp", imageAlt: "Cabina" })).toBe("published");
  });
});

