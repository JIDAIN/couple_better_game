import { describe, expect, it } from "vitest";
import {
  isFinalizedDriveBridgeLedger,
  type DriveBridgeLedgerRow,
} from "../../lib/server/drive-bridge-ledger";

function row(
  status: DriveBridgeLedgerRow["status"],
  receipt: unknown,
): DriveBridgeLedgerRow {
  return {
    command_id: "00000000-0000-4000-8000-000000000001",
    actor: "cat",
    tool: "life_mutate",
    request_hash: "hash",
    status,
    receipt,
  };
}

describe("Harbor Fast Wake ledger reconciliation", () => {
  it("treats succeeded and failed commands with receipts as finalized delivery", () => {
    expect(isFinalizedDriveBridgeLedger(row("succeeded", { ok: true }))).toBe(true);
    expect(isFinalizedDriveBridgeLedger(row("failed", { ok: false }))).toBe(true);
  });

  it("does not reconcile a still-processing or receipt-less command", () => {
    expect(isFinalizedDriveBridgeLedger(row("processing", null))).toBe(false);
    expect(isFinalizedDriveBridgeLedger(row("succeeded", null))).toBe(false);
    expect(isFinalizedDriveBridgeLedger(null)).toBe(false);
  });
});
