import { render, screen } from "@testing-library/react";
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
});
