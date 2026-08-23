import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BetaNotice } from "./BetaNotice";

describe("BetaNotice", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("identifies a beta release clearly", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "fixtures");
    vi.stubEnv("NEXT_PUBLIC_RELEASE_STAGE", "beta");

    render(<BetaNotice />);

    expect(
      screen.getByRole("complementary", { name: /estado de esta versión/i }),
    ).toHaveTextContent(/versión beta/i);
  });

  it("does not render on a live release", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "fixtures");
    vi.stubEnv("NEXT_PUBLIC_RELEASE_STAGE", "live");

    const { container } = render(<BetaNotice />);

    expect(container).toBeEmptyDOMElement();
  });
});
