import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("updates the real preview while writing and exposes the composition limit", async () => {
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
    const frame = screen.getByTitle(/Vista previa real de Portada a 390 píxeles/i) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");
    expect(title).toHaveAttribute("maxlength", "96");
    fireEvent.input(title, { target: { value: "Una portada actualizada" } });
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "piel-canela-content-preview",
      fields: expect.arrayContaining([expect.objectContaining({ key: "hero_title", value: "Una portada actualizada" })]),
    }), window.location.origin));
    expect(screen.getByText("Vista previa de esta edición")).toBeInTheDocument();
    expect(document.querySelector<HTMLElement>(".content-preview-frame")?.style.width).toBe("390px");
    fireEvent.click(screen.getByRole("button", { name: "1440 px" }));
    expect(document.querySelector<HTMLElement>(".content-preview-frame")?.style.width).toBe("1440px");
  });
});
