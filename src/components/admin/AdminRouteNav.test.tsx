import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminRouteNav } from "./AdminRouteNav";

describe("AdminRouteNav", () => {
  it("keeps content and access governance exclusive to technical owners", () => {
    const { rerender } = render(<AdminRouteNav current="operations" />);
    expect(screen.queryByRole("link", { name: /^contenido$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /accesos y actividad/i })).not.toBeInTheDocument();

    rerender(<AdminRouteNav current="operations" canManageAccess />);
    expect(screen.getByRole("link", { name: /^contenido$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /accesos y actividad/i })).toBeInTheDocument();
  });
});
