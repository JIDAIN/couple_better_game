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
    currencySemanticsVersion: 2,
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

function request(password = "secret", cookie?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  return new Request("http://localhost/api/save-data", {
    method: "POST",
    headers,
    body: JSON.stringify({
      password,
      data: syncPayload(),
    }),
  });
}

function cookieFrom(response: Response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.split(";", 1)[0];
}

describe("save data route", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATA_EDIT_PASSWORD: "secret",
      SUPABASE_SECRET_KEY: "test-secret-key",
      SUPABASE_URL: "https://example.supabase.co",
      COUPLE_SPACE_SLUG: "couple-better-game",
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

  it("requires a cloud session before the first upload", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      errorCode: "CLOUD_SESSION_REQUIRED",
    });
    expect(cookieFrom(response)).toMatch(/^couple-cloud-session=.+/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("writes the canonical snapshot to the Supabase RPC after session bootstrap", async () => {
    const bootstrap = await POST(request());
    const cookie = cookieFrom(bootstrap);

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { ok: true, updatedAt: "2026-05-21T00:00:01.000Z" },
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request("secret", cookie));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.updatedAt).toBe("string");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://example.supabase.co/rest/v1/rpc/replace_home_sync_snapshot",
    );
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      apikey: "test-secret-key",
      Authorization: "Bearer test-secret-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(options.body))).toMatchObject({
      p_space_slug: "couple-better-game",
      p_data: {
        schemaVersion: 1,
        currencySemanticsVersion: 2,
      },
    });
  });
});
