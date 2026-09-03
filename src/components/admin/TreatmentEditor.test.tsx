import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TreatmentEditor } from "./TreatmentEditor";

const uploadToSignedUrl = vi.fn(async () => ({ error: null }));
const createIntent = vi.fn(async (treatmentId: string) => {
  void treatmentId;
  return { ok: true, intent: { id: "50000000-0000-4000-8000-000000000001", path: "user/image.webp", token: "signed", expiresAt: new Date(Date.now() + 1000).toISOString() } };
});
const finalizeUpload = vi.fn(async (uploadId: string) => {
  void uploadId;
  return { ok: true, imagePath: "treatments/40000000-0000-4000-8000-000000000001/image.webp", width: 1080, height: 1350 };
});

vi.mock("@/app/admin/catalogo/actions", () => ({
  initialSaveTreatmentState: { status: "idle" },
  saveTreatment: vi.fn(),
  deleteTreatment: vi.fn(),
}));
vi.mock("@/app/admin/catalogo/media-actions", () => ({
  createTreatmentMediaUploadIntent: (treatmentId: string) => createIntent(treatmentId),
  finalizeTreatmentMediaUpload: (uploadId: string) => finalizeUpload(uploadId),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ storage: { from: () => ({ uploadToSignedUrl }) } }),
}));
vi.mock("@/lib/admin/treatment-media", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/treatment-media")>("@/lib/admin/treatment-media");
  return {
    ...actual,
    normalizeTreatmentImage: vi.fn(async () => ({ blob: new Blob(["webp"], { type: "image/webp" }), width: 1080, height: 1350, sourceInspection: { valid: true, width: 1080, height: 1350 } })),
  };
});

Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

const category = { id: "10000000-0000-4000-8000-000000000001", name: "Bienestar", slug: "bienestar", short_description: "Tratamientos para acompañar el bienestar.", icon_name: "FlowerLotus", display_order: 1, is_active: true };
const specialty = { id: "20000000-0000-4000-8000-000000000001", name: "Masoterapia", is_active: true };

describe("TreatmentEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("separates draft saving from publication", () => {
    render(<TreatmentEditor treatmentId="40000000-0000-4000-8000-000000000001" isNew categories={[category]} specialties={[specialty]} professionals={[]} />);
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toHaveAttribute("value", "draft");
    expect(screen.getByRole("button", { name: "Publicar tratamiento" })).toHaveAttribute("value", "publish");
  });

  it("uploads normalized media directly and only then exposes the final path", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreatmentEditor treatmentId="40000000-0000-4000-8000-000000000001" isNew categories={[category]} specialties={[specialty]} professionals={[]} />);
    await user.upload(screen.getByLabelText(/subir o reemplazar imagen/i), new File(["image"], "tratamiento.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Imagen lista para guardar.")).toBeInTheDocument();
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(1);
    expect(finalizeUpload).toHaveBeenCalledTimes(1);
    expect(container.querySelector('input[name="imagePath"]')).toHaveValue("treatments/40000000-0000-4000-8000-000000000001/image.webp");
  });
});
