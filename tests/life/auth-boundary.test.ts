import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("V2-R1B fixed account boundary", () => {
  it("uses only the two fixed accounts and one shared password login", () => {
    const login = source("components/life/LifeLoginPage.tsx");
    expect(login).toContain('(["cat", "fish"] as const)');
    expect(login).toContain('fetch("/api/auth/login"');
    expect(login).not.toContain("signup");
    expect(login).not.toContain("email");
    expect(login).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("binds the server session to partnerKey", () => {
    const fixedAuth = source("lib/server/fixed-life-auth.ts");
    expect(fixedAuth).toContain("LIFE_ACCOUNT_COOKIE");
    expect(fixedAuth).toContain('partnerKey: LifePartnerKey');
    expect(fixedAuth).toContain('createHmac("sha256"');
    expect(fixedAuth).toContain("isValidSyncPassword");
  });

  it("enforces personal ownership on mood, sleep and weight writes", () => {
    for (const path of [
      "app/api/life/mood/route.ts",
      "app/api/life/sleep/route.ts",
      "app/api/life/weights/route.ts",
    ]) {
      expect(source(path)).toContain("authorizePersonalPartnerWrite");
    }
    expect(source("lib/server/life-api.ts")).toContain("OWN_RECORD_ONLY");
  });

  it("removes unused registration and pairing schema in the final migration", () => {
    const cleanup = source("supabase/migrations/20260902154500_remove_unused_auth_pairing.sql");
    expect(cleanup).toContain("DROP TABLE IF EXISTS public.couple_space_invites");
    expect(cleanup).toContain("DROP TABLE IF EXISTS public.couple_space_members");
    expect(cleanup).toContain("DROP TABLE IF EXISTS public.life_user_profiles");
  });

  it("still prevents Git-triggered Vercel deployments", () => {
    const config = JSON.parse(source("vercel.json")) as { git?: { deploymentEnabled?: boolean } };
    expect(config.git?.deploymentEnabled).toBe(false);
  });
});
