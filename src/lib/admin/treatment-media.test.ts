import { describe, expect, it } from "vitest";
import { constrainedImageSize } from "./treatment-media";

describe("treatment media normalization", () => {
  it("keeps small accepted images at their original dimensions", () => {
    expect(constrainedImageSize(1080, 1350)).toEqual({ width: 1080, height: 1350 });
  });

  it("limits the longest edge without changing the ratio", () => {
    expect(constrainedImageSize(4800, 6000)).toEqual({ width: 2560, height: 3200 });
  });
});
