---
Date Created: 2026-03-23T18:05:32+11:00
Date Updated: 2026-03-24T00:24:28+11:00
status: completed
created_by: Claude Opus
priority: high
depends_on: refactor-schema-foundation
blocks: null
related_spec: 001-phase-1-snapshot-fields
---

# LLM Plan: Delegation & Consumers — Consolidate Storage, DDL & Downstream Files

**Plan B of 2** — requires Plan A (`refactor-schema-foundation.md`) to be complete and committed.

## Context

Plan A centralised column constants, consolidated types, and replaced all hardcoded SELECT/INSERT column lists. Plan B handles the **structural refactoring**: consolidating duplicate storage functions, replacing DDL in init functions, and updating downstream consumers (ResponseProcessor, ChromaSync, PaginationHelper, SSE types).

This plan contains the highest-risk step (storage delegation) and should be executed in a fresh session with clean context.

## Prerequisites

- Plan A fully committed and all tests passing
- Read the central schema module at `src/services/sqlite/schema/summary-columns.ts` to understand the constants and helpers available
- `bun test` passes, `tsc --noEmit` clean

## Steps

### Step 5: Consolidate storage delegation

**Tests FIRST (Red phase):** Write delegation equivalence tests in `tests/sqlite/storage-delegation.test.ts`:
- Call `summaries/store.ts::storeSummary()` with known test inputs, verify DB row is correct
- Call `observations/store.ts::storeObservation()` with known test inputs, verify DB row is correct
- Test that calling both paths with identical inputs produces identical rows (this will initially pass since both exist, but validates the contract before delegation)
- If behaviour differs (e.g. content-hash dedup), document the difference in the test file as a comment and test both paths independently

**Verify tests PASS** (these test existing behaviour before changing anything).

**Implementation (Green phase):**
- Compare `SessionStore.storeSummary()` and `summaries/store.ts::storeSummary()` line-by-line
- Make `SessionStore.storeSummary()` delegate to `summaries/store.ts::storeSummary()` — pass `this.db` as parameter
- Make `SessionStore.storeObservation()` delegate to `observations/store.ts::storeObservation()`
- Keep `transactions.ts` transaction bodies intact — they already use central constants from Plan A Step 4. Do NOT extract the transaction logic itself.
- Mark `SessionStore.storeSummary()` and `SessionStore.storeObservation()` as delegators with comments pointing to the canonical implementations
- **DO NOT fully consolidate if behaviour differs.** Known difference: `SessionStore.storeObservations()` (plural) may be missing content-hash dedup that `transactions.ts` has. Document this as a pre-existing issue — do not fix it in this refactor.

**Verify tests still PASS:** `bun test` (especially `tests/session_store.test.ts`, `tests/services/sqlite/`, and the new `storage-delegation.test.ts`), run a real session
**Commit:** `refactor: consolidate storage logic — SessionStore delegates to modular functions`

### Step 6: Replace DDL in initializeSchema and FTS

**Tests FIRST (Red phase):** Write `tests/sqlite/schema/schema-init.test.ts`:
- Create a fresh `:memory:` DB via `runner.ts::initializeSchema`, verify `PRAGMA table_info(session_summaries)` matches `SUMMARY_ALL_COLUMNS`
- Create a fresh `:memory:` DB via `SessionStore::initializeSchema`, verify same schema
- Verify FTS5 virtual table `session_summaries_fts` exists in both
- Verify FTS5 triggers fire on INSERT/UPDATE/DELETE
- These tests should PASS against the current code (testing existing behaviour before refactoring)

**Verify tests PASS** (baseline — existing init produces correct schema).

**Implementation (Green phase):**
- `src/services/sqlite/migrations/runner.ts` `initializeSchema()` → use `summaryCreateTableSQL()` from central schema module
- `src/services/sqlite/SessionStore.ts` `initializeSchema()` → same
- `src/services/sqlite/SessionSearch.ts` `ensureFTSTables()` → use `summaryFTSCreateSQL()` from central schema module

**DO NOT touch historical migration methods** — `migration004`, `migration006`, `removeSessionSummariesUniqueConstraint`, `addOnUpdateCascadeToForeignKeys`, etc. are immutable history. They must produce the exact DDL they always did.

**Verify tests still PASS:** `bun test` — the schema-init tests prove the refactored init produces identical schemas
**Commit:** `refactor: replace DDL in initializeSchema with central schema helpers`

### Step 7: Update downstream consumers

**Tests FIRST (Red phase):** Write `tests/sqlite/schema/consumer-integration.test.ts`:
- Test that `normalizeSummaryForStorage()` output includes all `SUMMARY_CONTENT_COLUMNS` fields (no silent field dropping)
- Test that `PaginationHelper.getSummaries()` query returns all content columns
- These tests should PASS against the current code (testing existing behaviour before refactoring)

**Verify tests PASS** (baseline).

**Implementation (Green phase):**
- `src/services/worker/agents/ResponseProcessor.ts` — update `normalizeSummaryForStorage()` to use the canonical type from `summaries/types.ts` instead of inline field mapping
- `src/services/worker/agents/types.ts` — update `SummarySSEPayload` to derive from the canonical type where possible
- `src/services/worker-types.ts` — `Summary` interface has `session_id` (from JOIN, not `memory_session_id`). Use `Omit<SessionSummaryRow, 'memory_session_id'> & { session_id: string }` or keep standalone with a documented note explaining the divergence.
- `src/services/worker/PaginationHelper.ts` — uses JOIN query with table-prefixed columns (`ss.request`). Replace column list with central constants, prefix with `ss.` for the JOIN context.
- `src/services/sync/ChromaSync.ts` — has 19 column references, its own inline type for summary fields, and per-field Chroma metadata construction (`field_type: 'investigated'`, etc.). Update to use central constants and canonical type.
- Update any existing tests for ResponseProcessor, ChromaSync, or PaginationHelper that reference old type names or field names

**Verify tests still PASS:** `bun test`, worker starts, viewer loads at `localhost:37777`, run a real session and check both SQLite and ChromaDB contain the expected data
**Commit:** `refactor: update downstream consumers to use central schema constants`

### Step 8: Final cleanup

- Grep entire `src/` for `investigated|learned|completed|next_steps` — should only appear in:
  - Central schema module (`summary-columns.ts`)
  - Old migration DDL (immutable, not touched)
  - Chroma metadata field names (if preserved for backward compat)
- Also grep for `INSERT INTO session_summaries` and `FROM session_summaries` to catch any missed query patterns
- Remove any dead imports created by type consolidation
- Run full test suite: `bun test`
- Verify TypeScript compilation: `tsc --noEmit`

**Commit:** `refactor: cleanup — remove dead imports from column centralisation`

## Verification (end of Plan B)

1. `bun test` — all tests pass
2. `tsc --noEmit` — no compilation errors
3. Worker starts at `localhost:37777`, viewer loads correctly
4. Run a real Claude Code session — snapshots generate, store, display, and inject into new sessions correctly
5. Final grep confirms column names only appear in central module + immutable migrations
6. Query DB — data matches pre-refactor state (no corruption)

## After Both Plans Complete

The codebase is ready for Phase 1 implementation (`/spec.implement` against `spectri/specs/01-drafting/001-phase-1-snapshot-fields/`). Adding the 12 new columns will require:
- Update `SUMMARY_CONTENT_COLUMNS` in `summary-columns.ts` (one place)
- Update the canonical type in `sqlite/types.ts` (one place)
- Add the migration method in `runner.ts` (new migration, does not touch central module)
- All SELECTs, INSERTs, types, and FTS5 automatically pick up the changes

This is the payoff of the refactor: 12 new columns → 2 file edits + 1 migration, instead of 27+ edits across 15 files.
