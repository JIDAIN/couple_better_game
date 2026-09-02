import { findRecordByIso } from "./daily-record-utils";
import type { DailyRecord, PersonKey } from "./types";

export type DailyGameOverview = {
  hasRecord: boolean;
  deficitKcal: number | null;
  exerciseMinutes: number | null;
  weightKg: number | null;
};

export function selectDailyGameOverview(
  records: DailyRecord[],
  recordDate: string,
  person: PersonKey,
): DailyGameOverview {
  const record = findRecordByIso(records, recordDate);
  if (!record) {
    return {
      hasRecord: false,
      deficitKcal: null,
      exerciseMinutes: null,
      weightKg: null,
    };
  }

  const side = record[person];
  return {
    hasRecord: true,
    deficitKcal: side.deficit,
    exerciseMinutes: side.minutes,
    weightKg: side.weightKg,
  };
}