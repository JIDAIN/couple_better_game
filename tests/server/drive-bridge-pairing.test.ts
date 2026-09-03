import { describe, expect, it } from "vitest";
import {
  DriveBridgePairingError,
  parseDriveBridgePairingPayload,
} from "../../lib/server/drive-bridge-pairing";

const CAT_SHEET = "1inEL4mXOQ2-w5UrkqtLoK6aU2o-4auCQSLlEGuA3cVo";
const CODE = "aWQiXklCM-NUotYxXDBIXdA1";
const WEB_APP = "https://script.google.com/macros/s/AKfycbwExampleDeployment1234567890/exec";

describe("drive bridge worker pairing", () => {
  it("accepts a valid actor-bound worker payload", () => {
    expect(
      parseDriveBridgePairingPayload({
        bridgeId: "cat",
        pairingCode: CODE,
        sheetId: CAT_SHEET,
        webAppUrl: WEB_APP,
      }),
    ).toEqual({
      bridgeId: "cat",
      pairingCode: CODE,
      sheetId: CAT_SHEET,
      webAppUrl: WEB_APP,
    });
  });

  it.each([
    { bridgeId: "dog", pairingCode: CODE, sheetId: CAT_SHEET, webAppUrl: WEB_APP },
    { bridgeId: "cat", pairingCode: "short", sheetId: CAT_SHEET, webAppUrl: WEB_APP },
    { bridgeId: "cat", pairingCode: CODE, sheetId: "bad", webAppUrl: WEB_APP },
    { bridgeId: "cat", pairingCode: CODE, sheetId: CAT_SHEET, webAppUrl: "https://example.com/exec" },
    { bridgeId: "cat", pairingCode: CODE, sheetId: CAT_SHEET, webAppUrl: "https://script.google.com/macros/s/x/dev" },
  ])("rejects malformed pairing payload %#", (payload) => {
    expect(() => parseDriveBridgePairingPayload(payload)).toThrow(DriveBridgePairingError);
  });
});
