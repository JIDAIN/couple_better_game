# R11.3 AI Access Core Query & Reliability Hardening — 2026-09-06

## Why this release exists

R11/R11.2 successfully established the direct MCP → AI Access Core → canonical services → Supabase path and passed real OAuth/MCP client connection tests through RikkaHub. Real natural-language acceptance then exposed several contract/reliability gaps that were not visible in basic unit/smoke tests.

## Real acceptance findings that drove R11.3

1. `day` ignored `person`, so `me` and `ta` could return identical mixed-person data.
2. `day` omitted meals, forcing the model to compose multiple reads for a natural “today summary”.
3. `mood` / `sleep` / `activity` were writable resources but not first-class query resources, causing avoidable capability probing and schema guessing.
4. `weight` accepted date-like input from the model but returned history because the Core did not enforce date/range filtering.
5. A network interruption after a successful activity create could cause a model retry with a new tool-call id and create a duplicate record.
6. Personal writes were actor-bound, but an explicit `Ta` target could be silently corrected to the current actor instead of being rejected.
7. Activity default/shared participant semantics were not explicit enough for models.

## R11.3 changes

### Person-aware day bundle

`life_query(resource="day")` now applies `person=me|ta|all` to moods, sleeps and activities, and also returns meals for the same person/date. Shared activities (`participantScope=both`) are visible to either participant.

### First-class resource queries

`life_query` now supports `mood`, `sleep`, and `activity` directly. These resources share the same normalized date/person semantics as `day`.

### Weight date/range filtering

`weight` supports:
- history mode when no date/range is supplied,
- exact `date`,
- `dateFrom`,
- `dateTo`,
- `limit` after authoritative server filtering.

### Explicit personal-write rejection

Personal resources now reject an explicit `Ta` target instead of silently forcing the write onto the current OAuth actor. The OAuth identity remains authoritative.

### Activity participant semantics

- no participant target / `me` → current actor,
- `both` / `我们` / `双方` → one shared activity record,
- `ta` alone → rejected.

### Retry-safe create idempotency

For `activity` and `meal` creates, R11.3 derives a semantic fingerprint from the normalized business payload and current actor/date, scoped to a short 10-minute retry window. This lets immediate client/model retries after an uncertain network response resolve to the same canonical receipt/entity even when the MCP tool-call id changes.

The existing database `record_write_receipts` remains the authoritative idempotency ledger.

## Tests

- updated natural-language normalization tests,
- updated registry security expectation from “silently force actor” to “explicitly reject Ta”,
- added R11.3 source-contract regression tests for day bundle, weight filtering, retry idempotency, and personal write safety.

CI run #415:
- Test ✅
- Lint ✅
- Build ✅

The earlier CI run #414 correctly failed one historical test that expected the old silent-target rewrite. The test was updated to the new safer contract and the full suite then passed.

## Deployment status

R11.3 is code/CI ready but **not deployed to Production** in this change. Production requires a separate explicit user authorization. Automatic Vercel deployment remains disabled by policy.
