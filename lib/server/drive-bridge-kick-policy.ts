export function shouldAvoidSecondHarborWake(worker: Record<string, unknown>) {
  return worker.ok === false && worker.skipped === "locked";
}
