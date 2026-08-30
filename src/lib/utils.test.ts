import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins plain class names", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("drops falsy and conditional entries", () => {
    expect(cn("flex", false, undefined, null, { "sr-only": false, "gap-2": true })).toBe("flex gap-2");
  });

  it("resolves conflicting Tailwind utilities in favour of the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm text-red-500", "text-lg")).toBe("text-red-500 text-lg");
  });
});
