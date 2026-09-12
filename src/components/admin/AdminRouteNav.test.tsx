import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminRouteNav } from "./AdminRouteNav";

describe("AdminRouteNav", () => {
  it("keeps governance owner-only and links reception modules", () => {
    const { rerender } = render(<AdminRouteNav current="operations" />);
    expect(screen.getByRole("link", { name: "Contenido" })).toHaveAttribute("href", "/admin/contenido");
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/admin?module=agenda");
    expect(screen.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/admin/mi-cuenta");
    expect(screen.queryByRole("link", { name: /accesos y actividad/i })).not.toBeInTheDocument();
    rerender(<AdminRouteNav current="operations" canManageAccess />);
    expect(screen.getByRole("link", { name: /accesos y actividad/i })).toBeInTheDocument();
  });
  it("collapses without removing accessible labels", () => {
    render(<AdminRouteNav current="catalog" />);
    fireEvent.click(screen.getByRole("button", { name: "Contraer menú" }));
    expect(screen.getByRole("button", { name: "Expandir menú" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Tratamientos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tratamientos" })).toHaveAttribute("title", "Tratamientos");
  });
  it("uses a modal dialog and returns focus on Escape", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    render(<AdminRouteNav current="catalog" />);
    const trigger = screen.getByRole("button", { name: "Menú del panel" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent(dialog, new Event("cancel", { bubbles: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
    vi.unstubAllGlobals();
  });
});
