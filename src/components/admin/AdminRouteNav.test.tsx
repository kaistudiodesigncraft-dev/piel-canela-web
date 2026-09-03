import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminRouteNav } from "./AdminRouteNav";

describe("AdminRouteNav", () => {
  it("lets operational managers edit content while keeping governance owner-only", () => {
    const { rerender } = render(<AdminRouteNav current="operations" />);
    expect(screen.getByRole("link", { name: /^contenido$/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /accesos y actividad/i })).not.toBeInTheDocument();
    expect(screen.getByText("Deslizá")).toHaveAttribute("aria-hidden", "true");

    rerender(<AdminRouteNav current="operations" canManageAccess />);
    expect(screen.getByRole("link", { name: /^contenido$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /accesos y actividad/i })).toBeInTheDocument();
  });

  it("only shows the mobile scroll cue while more navigation remains", async () => {
    const { container } = render(<AdminRouteNav current="catalog" />);
    const nav = screen.getByRole("navigation", { name: /navegación administrativa/i });
    Object.defineProperty(nav, "scrollWidth", { configurable: true, value: 720 });
    Object.defineProperty(nav, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(nav, "scrollLeft", { configurable: true, writable: true, value: 0 });
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(container.firstElementChild).toHaveClass("has-scroll-hint"));

    Object.defineProperty(nav, "scrollLeft", { configurable: true, writable: true, value: 400 });
    fireEvent.scroll(nav);
    await waitFor(() => expect(container.firstElementChild).not.toHaveClass("has-scroll-hint"));
  });
});
