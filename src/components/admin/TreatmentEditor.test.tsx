import { fireEvent, render, screen } from "@testing-library/react";
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
const otherSpecialty = { id: "20000000-0000-4000-8000-000000000002", name: "Estética corporal", is_active: true };
const compatibleProfessional = { id: "30000000-0000-4000-8000-000000000001", specialty_id: specialty.id, specialty_ids: [specialty.id], full_name: "Profesional compatible", public_name: null, is_active: true };
const incompatibleProfessional = { id: "30000000-0000-4000-8000-000000000002", specialty_id: otherSpecialty.id, specialty_ids: [otherSpecialty.id], full_name: "Profesional de otra especialidad", public_name: null, is_active: true };

describe("TreatmentEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("separates draft saving from publication", () => {
    render(<TreatmentEditor treatmentId="40000000-0000-4000-8000-000000000001" isNew categories={[category]} specialties={[specialty]} professionals={[]} />);
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toHaveAttribute("value", "draft");
    expect(screen.getByRole("button", { name: "Publicar tratamiento" })).toHaveAttribute("value", "publish");
  });

  it("keeps media optional so catalog work can continue without a photograph", () => {
    render(<TreatmentEditor treatmentId="40000000-0000-4000-8000-000000000001" isNew categories={[category]} specialties={[specialty]} professionals={[]} />);

    expect(screen.getByLabelText(/subir o reemplazar imagen/i)).not.toBeRequired();
    expect(screen.getByText(/podés guardar o publicar el tratamiento sin imagen/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Publicar tratamiento" })).toBeEnabled();
  });

  it("only offers professionals enabled for the selected specialty", () => {
    render(<TreatmentEditor treatmentId="40000000-0000-4000-8000-000000000001" isNew categories={[category]} specialties={[specialty, otherSpecialty]} professionals={[compatibleProfessional, incompatibleProfessional]} />);

    expect(screen.getByText(/elegí una especialidad para ver solamente/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Especialidad"), { target: { value: specialty.id } });

    expect(screen.getByRole("checkbox", { name: /profesional compatible/i })).toBeEnabled();
    expect(screen.queryByText("Profesional de otra especialidad")).not.toBeInTheDocument();
  });

  it("clears an assignment when the specialty changes to an incompatible one", async () => {
    const user = userEvent.setup();
    render(<TreatmentEditor treatmentId="40000000-0000-4000-8000-000000000001" isNew categories={[category]} specialties={[specialty, otherSpecialty]} professionals={[compatibleProfessional, incompatibleProfessional]} />);

    fireEvent.change(screen.getByLabelText("Especialidad"), { target: { value: specialty.id } });
    const checkbox = screen.getByRole("checkbox", { name: /profesional compatible/i });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.change(screen.getByLabelText("Especialidad"), { target: { value: otherSpecialty.id } });
    expect(screen.queryByText("Profesional compatible")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /profesional de otra especialidad/i })).not.toBeChecked();
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
