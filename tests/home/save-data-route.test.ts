import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/save-data/route";
import {
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
} from "../../lib/home/settlement-rules";

const originalEnv = { ...process.env };

function syncPayload() {
  return {
    schemaVersion: 1,
    updatedAt: "2026-05-21T00:00:00.000Z",
    wallet: { gems: 0, coins: 0 },
    dailyRecords: [],
    exchangeRecords: [],
    exchangeCategories: [],
    heatmapStartDate: "2026-05-01",
    coinRules: DEFAULT_COIN_RULES,
    visualRules: DEFAULT_VISUAL_RULES,
  };
}

function request(password = "secret") {
  return new Request("http://localhost/api/save-data", {
    method: "POST",
    body: JSON.stringify({
      password,
      data: syncPayload(),
    }),
  });
}

describe("save data route", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: "token",
      GITHUB_REPO_OWNER: "owner",
      GITHUB_REPO_NAME: "repo",
      GITHUB_DATA_FILE_PATH: "public/data/couple-data.json",
      DATA_EDIT_PASSWORD: "secret",
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("returns WRONG_PASSWORD for invalid edit password", async () => {
    const response = await POST(request("bad"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      errorCode: "WRONG_PASSWORD",
    });
  });

  it("returns GITHUB_CONFLICT when GitHub contents update conflicts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ sha: "current-sha" }, { status: 200 }),
      )
      .mockResolvedValueOnce(
        Response.json({ message: "sha does not match" }, { status: 409 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      errorCode: "GITHUB_CONFLICT",
      error: "sha does not match",
    });
  });
});
