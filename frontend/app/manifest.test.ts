import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("web app manifest", () => {
  it("is installable: name, start_url, standalone display and both icon sizes", () => {
    const m = manifest();
    expect(m.name).toBe("SillyGames");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    const sizes = new Set(m.icons?.map((icon) => icon.sizes));
    expect(sizes).toEqual(new Set(["192x192", "512x512"]));
    expect(m.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(m.theme_color).toBe("#c2410c");
  });
});
