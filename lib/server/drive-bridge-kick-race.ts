export type HarborWakeRaceResult<TWorker, TLedger> =
  | { kind: "worker"; worker: TWorker }
  | { kind: "worker-error"; error: unknown }
  | { kind: "ledger"; ledger: TLedger };

export async function raceHarborWorkerAndLedger<TWorker, TLedger>(options: {
  worker: Promise<TWorker>;
  readLedger: () => Promise<TLedger | null>;
  abortWorker: () => void;
  maxLedgerWaitMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<HarborWakeRaceResult<TWorker, TLedger>> {
  const {
    worker,
    readLedger,
    abortWorker,
    maxLedgerWaitMs = 8_000,
    pollIntervalMs = 250,
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  const workerOutcome: Promise<HarborWakeRaceResult<TWorker, TLedger>> = worker.then(
    (value) => ({ kind: "worker", worker: value }),
    (error) => ({ kind: "worker-error", error }),
  );

  const startedAt = now();
  while (now() - startedAt < maxLedgerWaitMs) {
    const tickOrWorker = await Promise.race([
      workerOutcome,
      sleep(pollIntervalMs).then(() => ({ kind: "tick" }) as const),
    ]);

    if (tickOrWorker.kind !== "tick") {
      return tickOrWorker;
    }

    const ledger = await readLedger();
    if (ledger !== null) {
      abortWorker();
      return { kind: "ledger", ledger };
    }
  }

  return workerOutcome;
}
