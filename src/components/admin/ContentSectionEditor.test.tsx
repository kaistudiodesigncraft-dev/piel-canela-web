import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSiteContent } from "@/domain/site-content";
import { ContentSectionEditor } from "./ContentSectionEditor";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/app/admin/contenido/actions", () => ({
  submitSiteContentSection: vi.fn(async () => ({ status: "saved", fieldErrors: {} })),
  restoreSiteContentRevision: vi.fn(async () => undefined),
  createSiteContentMediaUploadIntent: vi.fn(),
  finalizeSiteContentMediaUpload: vi.fn(),
}));

describe("ContentSectionEditor", () => {
  beforeEach(() => refresh.mockClear());

  it("updates the preview while writing and exposes the composition limit", () => {
    const fields = getDefaultSiteContent().filter((field) => field.section === "hero");
    render(
      <ContentSectionEditor
        section="hero"
        title="Portada"
        description="Presentación principal"
        fields={fields}
        publishedFields={fields}
        revisions={[]}
      />,
    );

    const title = screen.getByLabelText(/Título principal/i);
    expect(title).toHaveAttribute("maxlength", "96");
    fireEvent.input(title, { target: { value: "Una portada actualizada" } });
    expect(screen.getByRole("heading", { name: "Una portada actualizada" })).toBeInTheDocument();
    expect(screen.getByText("Vista previa de esta edición")).toBeInTheDocument();
  });
});
