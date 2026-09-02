import { describe, expect, it } from "vitest";
import { isLifeNavItemActive } from "../../lib/life/navigation";

describe("isLifeNavItemActive", () => {
  it("matches today only on the exact root route", () => {
    expect(isLifeNavItemActive("/", "/")).toBe(true);
    expect(isLifeNavItemActive("/food", "/")).toBe(false);
  });

  it("keeps a parent tab active on child pages", () => {
    expect(isLifeNavItemActive("/nest/medicine", "/nest")).toBe(true);
    expect(isLifeNavItemActive("/calendar/2026-09-02", "/calendar")).toBe(true);
  });

  it("does not confuse sibling route prefixes", () => {
    expect(isLifeNavItemActive("/nesting", "/nest")).toBe(false);
    expect(isLifeNavItemActive("/foodie", "/food")).toBe(false);
  });
});
