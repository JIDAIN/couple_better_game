import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const code = readFileSync(
  join(root, "scripts/google-apps-script/r10-drive-bridge/Code.gs"),
  "utf8",
);
const fastKick = readFileSync(
  join(root, "scripts/google-apps-script/r10-drive-bridge/FastKick.gs"),
  "utf8",
);

describe("Harbor R10.4 targeted Apps Script Fast Kick source contract", () => {
  it("routes explicit commandId wakes to the targeted processor and preserves legacy batch fallback", () => {
    expect(code).toContain("body.commandId");
    expect(code).toContain("processCommandByIdFast_(body.commandId)");
    expect(code).toContain(": processPendingCommands()");
  });

  it("uses a short lock wait and exact command lookup instead of a full-sheet pending scan", () => {
    expect(fastKick).toContain("LOCK_WAIT_MS: 250");
    expect(fastKick).toContain("TAIL_ROWS: 64");
    expect(fastKick).toContain("createTextFinder(commandId)");
    expect(fastKick).toContain("matchEntireCell(true)");
    expect(fastKick).toContain("VISIBILITY_WAIT_MS: 1200");
  });

  it("executes only the requested command", () => {
    expect(fastKick).toContain("commands: [item.command]");
    expect(fastKick).not.toContain("MAX_COMMANDS_PER_RUN");
  });

  it("releases the script lock before the fallback snapshot refresh", () => {
    const release = fastKick.lastIndexOf("lock.releaseLock()");
    const refresh = fastKick.lastIndexOf("refreshSnapshot()");
    expect(release).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(release);
  });

  it("does not treat a command that is still invisible as a successful execution", () => {
    expect(fastKick).toContain("skipped: 'command_not_visible'");
    expect(fastKick).toContain("skipped: 'locked'");
  });
});
