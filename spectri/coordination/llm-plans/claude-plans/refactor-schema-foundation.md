---
Date Created: 2026-03-23T18:05:32+11:00
Date Updated: 2026-03-23T18:05:32+11:00
status: pending
created_by: Claude Opus
priority: high
depends_on: null
blocks: refactor-delegation-consumers
related_spec: 001-phase-1-snapshot-fields
---

# LLM Plan: Schema Foundation — Centralise Constants, Types & Column Lists

**Plan A of 2** — must complete before Plan B (`refactor-delegation-consumers.md`).

## Context

The agent-mem codebase has 27 hardcoded column lists across 12 files, 11 duplicate type definitions across 6 files, and duplicated storage logic. Phase 1 feature work (spec 001) adds 12 new columns to `session_summaries`. This refactor centralises column definitions so Phase 1 only updates one place.

This plan covers the **mechanical substitution** work: creating the central schema module and replacing all hardcoded SELECT/INSERT column lists. Low risk, high volume.

## Prerequisites

- All existing tests pass (`bun test`)
- Working tree is clean

## Step 0: Orient

Before writing any code, read these files to understand the current state:
- `src/services/sqlite/summaries/types.ts` — current type definitions (SummaryInput, SessionSummary, etc.)
- `src/services/sqlite/types.ts` — SessionSummaryRow (the DB row type)
- `src/types/database.ts` — SessionSummaryRecord, ObservationRecord type union
- `src/services/sqlite/summaries/store.ts` — current storeSummary INSERT
- `src/services/sqlite/summaries/get.ts` — current SELECT queries
- `src/sdk/parser.ts` — ParsedSummary interface
- `src/services/context/types.ts` — duplicate SessionSummary
- `src/services/worker-types.ts` — duplicate Summary and ParsedSummary
- `AGENTS.md` — project context, terminology, architecture

This gives you the full picture of what's duplicated and what the canonical definitions look like.

## Steps

### Step 1: Create central schema constants

**New files:**
- `src/services/sqlite/schema/summary-columns.ts` — single source of truth for all summary column definitions
- `src/services/sqlite/schema/observation-columns.ts` — same for observations
- `src/services/sqlite/schema/index.ts` — barrel export

**Exports from summary-columns.ts:**
- `SUMMARY_CONTENT_COLUMNS` — `['request', 'investigated', 'learned', 'completed', 'next_steps', 'files_read', 'files_edited', 'notes']`
- `SUMMARY_META_COLUMNS` — `['id', 'memory_session_id', 'project', 'prompt_number', 'discovery_tokens', 'created_at', 'created_at_epoch']`
- `SUMMARY_ALL_COLUMNS` — combined (meta + content)
- `SUMMARY_FTS_COLUMNS` — `['request', 'investigated', 'learned', 'completed', 'next_steps', 'notes']` (subset for FTS5)
- `SUMMARY_INSERT_COLUMNS` — `['memory_session_id', 'project', 'request', 'investigated', 'learned', 'completed', 'next_steps', 'files_read', 'files_edited', 'notes', 'prompt_number', 'discovery_tokens', 'created_at', 'created_at_epoch']` (meta except `id` which is autoincrement, plus all content)
- `summarySelectCols(cols: string[])` — generates `"col1, col2, col3"` from array
- `summaryInsertPlaceholders()` — generates `"(?, ?, ?, ...)"` matching INSERT_COLUMNS length
- `summaryFTSCreateSQL(tableName: string)` — generates FTS5 virtual table DDL + triggers

**Tests:** Write `tests/sqlite/schema/summary-columns.test.ts`:
- Column arrays contain expected fields, no duplicates
- `summarySelectCols()` produces correct SQL string
- `summaryInsertPlaceholders()` matches `SUMMARY_INSERT_COLUMNS.length`
- `summaryFTSCreateSQL()` produces valid SQL (execute against `:memory:` DB)
- Schema roundtrip: create table in `:memory:`, verify `PRAGMA table_info` matches constants

**Verify:** `bun test`, `tsc --noEmit`
**Commit:** `refactor: add central schema column constants for summaries and observations`

### Step 2: Consolidate type definitions

- Make projection types in `src/services/sqlite/summaries/types.ts` use `Pick<SessionSummaryRow, ...>` from `src/services/sqlite/types.ts` where nullability matches. Keep standalone interfaces where nullability differs (e.g. `SummaryInput` where fields are non-nullable).
- Remove `SessionSummaryRecord` from `src/types/database.ts` — re-export `SessionSummaryRow` from `sqlite/types.ts`
- Remove duplicate `ParsedSummary` from `src/services/worker-types.ts` — import from `src/sdk/parser.ts`
- Remove duplicate `SessionSummary` from `src/services/context/types.ts` — import from `summaries/types.ts` or derive via `Pick<>`
- Update all import sites across the codebase
- Add `'mistake'` to `ObservationRecord` type union in `src/types/database.ts`. Keep `'discovery'` for backward compatibility.

**Tests:** No new test files needed — existing tests validate the type changes via compilation. If any existing tests import removed types, update their imports to use the canonical source.
**Verify:** `tsc --noEmit` (this is the most important check — type errors will cascade), `bun test` (fix any test that fails due to import changes)
**Commit:** `refactor: consolidate summary type definitions to single source of truth`

### Step 3: Replace hardcoded SELECT column lists

Replace inline column strings with `summarySelectCols(...)` in:
- `src/services/sqlite/summaries/get.ts` — `getSummaryForSession()` (1 explicit SELECT; note `getSummaryById` and `getSummariesByIds` use `SELECT *` and need no changes)
- `src/services/sqlite/summaries/recent.ts` — `getRecentSummaries()`, `getRecentSummariesWithSessionInfo()`, `getAllRecentSummaries()` (3 SELECTs, each with different column subsets)
- `src/services/context/ObservationCompiler.ts` — `querySummaries()`, `querySummariesMulti()` (2 SELECTs)

**Tests:** Add regression tests to `tests/sqlite/schema/summary-columns.test.ts` — for each replaced SELECT, verify the generated SQL string matches the original hardcoded string exactly (snapshot comparison). This catches column order or spacing differences.
**Verify:** `bun test`, worker starts and serves viewer at `localhost:37777`
**Commit:** `refactor: replace hardcoded SELECT column lists with central constants`

### Step 4: Replace hardcoded INSERT column lists

Replace inline INSERT SQL with `SUMMARY_INSERT_COLUMNS` and `summaryInsertPlaceholders()` in:
- `src/services/sqlite/summaries/store.ts` — `storeSummary()` (1 INSERT)
- `src/services/sqlite/transactions.ts` — `storeObservationsAndMarkComplete()` and `storeObservations()` (2 INSERTs)
- `src/services/sqlite/import/bulk.ts` — `importSessionSummary()` (1 INSERT)

**Important:** Verify parameter order matches column order after replacement. A mismatch silently corrupts data.

**Tests:** Add INSERT roundtrip test to `tests/sqlite/schema/summary-columns.test.ts` — INSERT a row using `SUMMARY_INSERT_COLUMNS` and `summaryInsertPlaceholders()`, read it back with `SELECT *`, verify every field has the expected value in the expected column. This catches parameter order mismatches.
**Verify:** `bun test`, run a real session to verify snapshots still store correctly
**Commit:** `refactor: replace hardcoded INSERT column lists with central constants`

## Verification (end of Plan A)

1. `bun test` — all tests pass
2. `tsc --noEmit` — no compilation errors
3. Worker starts at `localhost:37777`
4. Grep for `investigated|learned|completed|next_steps` in `src/` — should only appear in: central schema module, old migration DDL (immutable), and files not yet touched (those are Plan B's scope)
5. Run a real Claude Code session — snapshots generate and display correctly

## What Plan B Picks Up

Plan B (`refactor-delegation-consumers.md`) handles:
- Step 5: Storage delegation consolidation (highest risk)
- Step 6: DDL in initializeSchema and ensureFTSTables
- Step 7: ResponseProcessor, ChromaSync, PaginationHelper, SSE types
- Step 8: Final cleanup
