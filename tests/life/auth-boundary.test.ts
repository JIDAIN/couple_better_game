import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("V2-R1B auth boundary", () => {
  it("keeps service secrets out of the login page", () => {
    const login = source("components/life/LifeLoginPage.tsx");
    expect(login).toContain("/api/auth/login");
    expect(login).toContain("/api/auth/signup");
    expect(login).not.toContain("SUPABASE_SECRET_KEY");
    expect(login).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("enforces personal ownership on mood, sleep and weight writes", () => {
    for (const path of [
      "app/api/life/mood/route.ts",
      "app/api/life/sleep/route.ts",
      "app/api/life/weights/route.ts",
    ]) {
      expect(source(path)).toContain("authorizePersonalPartnerWrite");
    }
  });

  it("keeps old cloud session explicitly transitional", () => {
    const lifeApi = source("lib/server/life-api.ts");
    expect(lifeApi).toContain("Migration compatibility only");
    expect(lifeApi).toContain("isAuthorizedCloudRequest");
    expect(lifeApi).toContain("OWN_RECORD_ONLY");
  });

  it("stores only invite hashes in the pairing schema", () => {
    const migration = source("supabase/migrations/20260902150500_add_auth_pairing_flow.sql");
    expect(migration).toContain("code_hash");
    expect(migration).toContain("digest(v_code, 'sha256')");
    expect(migration).not.toMatch(/\n\s*code\s+text/);
  });

  it("still prevents Git-triggered Vercel deployments", () => {
    const config = JSON.parse(source("vercel.json")) as { git?: { deploymentEnabled?: boolean } };
    expect(config.git?.deploymentEnabled).toBe(false);
  });
});
