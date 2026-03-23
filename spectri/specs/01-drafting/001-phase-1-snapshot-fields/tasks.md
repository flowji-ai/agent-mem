---
Date Created: 2026-03-23T15:54:47+11:00
Date Updated: 2026-03-23T15:54:47+11:00
created_by: Claude Opus
updated_by: Claude Opus
description: "Task list for Phase 1 — Snapshot Fields, Manual Capture & Noise Reduction"
---

# Tasks: Phase 1 — Snapshot Fields, Manual Capture & Noise Reduction

**Input**: Design documents from `spectri/specs/01-drafting/001-phase-1-snapshot-fields/`
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Tests are **MANDATORY** (TypeScript/Bun codebase — Article III: Test-First Imperative).

**Organization**: Tasks grouped by user story. Stories 1 and 3 share foundational infrastructure (schema, mode file) so both depend on Phase 2 completion.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included

---

## Phase 1: Setup

**Purpose**: Checkpoint and verify environment before implementation

- [ ] T001 Verify Bun runtime and `bun test` work in the repo
- [ ] T002 Verify claude-mem worker starts on port 37777 (`bun run src/services/worker-service.ts`)
- [ ] T003 Verify existing tests pass (`bun test`)
- [ ] T004 Back up `~/.claude-mem/claude-mem.db` before schema changes

- [ ] T005 [Checkpoint] Create implementation summary documenting setup verification
- [ ] T006 [Checkpoint] Commit work + summary to Git

---

## Phase 2: Foundational — Schema & Types

**Purpose**: DB migration and TypeScript type updates. MUST complete before any story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests (MUST write first — verify they FAIL)

- [ ] T007 Write migration test in `tests/sqlite/migration-schema.test.ts` — verify migration runs cleanly, all new columns exist, FTS5 triggers fire on INSERT/UPDATE/DELETE, old records survive with null new fields
- [ ] T008 Write parser test in `tests/snapshot-parser.test.ts` — verify parser correctly extracts new XML fields, handles missing fields (returns undefined not filler), handles old-format XML gracefully

### Implementation (makes tests pass)

- [ ] T009 Determine next migration version number by reading `src/services/sqlite/migrations/runner.ts` and finding the highest existing version
- [ ] T010 Add migration as a new private method in `src/services/sqlite/migrations/runner.ts` following the existing pattern (version check + ALTER TABLE). Columns: `title TEXT`, `decision_log TEXT`, `decision_trade_offs TEXT`, `constraints_log TEXT`, `mistakes TEXT`, `gotchas TEXT`, `commit_ref TEXT`, `open_questions TEXT`, `unresolved TEXT`, `importance INTEGER DEFAULT 5`, `hidden_fields TEXT`, `source TEXT DEFAULT 'auto'`. T010 and T011 MUST be in the same migration method (atomic).
- [ ] T011 In the same migration method as T010, update FTS5 virtual table and triggers — DROP existing `session_summaries_fts` and its three triggers (`_ai`, `_ad`, `_au`), CREATE new FTS5 table indexing the new columns, CREATE new sync triggers. Also check `src/services/sqlite/SessionSearch.ts` for a duplicate `ensureFTSTables()` method and update if present.
- [ ] T012 [P] Update `src/services/sqlite/summaries/types.ts` — add new fields to `SummaryInput`, `SessionSummary`, `FullSummary`, `RecentSummary`, `SummaryWithSessionInfo` interfaces
- [ ] T013 [P] Update `src/sdk/parser.ts` — update `ParsedSummary` interface and the parser function to extract new XML fields (`decision_log`, `decision_trade_offs`, `constraints_log`, `mistakes`, `gotchas`, `commit_ref`, `open_questions`, `unresolved`, `title`). Verify the actual function name in the file (may be `parseSummary` singular).
- [ ] T014 [P] Update `src/services/sqlite/summaries/store.ts` — update `storeSummary()` INSERT statement to include all new columns
- [ ] T015 [P] Update `src/types/database.ts` — add new fields to `SessionSummaryRecord`, add `'mistake'` to `ObservationRecord` type union. Keep `'discovery'` in the union for backward compatibility with existing DB records.
- [ ] T016 [P] Update `src/services/sqlite/summaries/get.ts` — update SELECT column lists to include new fields
- [ ] T017 [P] Update `src/services/sqlite/summaries/recent.ts` — update SELECT column lists to include new fields
- [ ] T017a Grep codebase for `investigated|learned|completed|next_steps` to find any other files with hardcoded column lists (e.g. `ResponseProcessor.ts`, `worker-types.ts`, `PaginationHelper.ts`, `ChromaSync.ts`, `SessionStore.ts`) and update them all to include new fields

- [ ] T018 [Checkpoint] Create implementation summary documenting schema & types work
- [ ] T019 [Checkpoint] Commit work + summary to Git

**Checkpoint**: Schema ready — user story implementation can now begin

---

## Phase 3: User Story 1 + User Story 3 — Structured Fields & Noise Reduction (Priority: P1) 🎯 MVP

**Goal**: Create custom mode with structured extraction prompt. Remove discovery noise. Add mistake observations. Enforce field precision and empty-field omission. Switch to gemini-2.5-flash.

**Independent Test**: Run a Claude Code session with a decision, a reversal, a mistake, and several file reads. Inspect the DB — structured fields populated correctly, no discovery observations, empty fields absent, file paths exact.

**Note**: Stories 1 and 3 are implemented together because they both modify the mode file and extraction prompt. The mode defines *what* gets captured (Story 3) and the prompt defines *how* it gets structured (Story 1).

### Tests (MUST write first — verify they FAIL)

- [ ] T020 [P] [US1] Write extraction test in `tests/snapshot-extraction.test.ts` — test all structured fields: (a) decision with trade-offs → `decision_log` + `decision_trade_offs`, (b) reversed decision → only final decision with reversal noted, (c) standing rule → `constraints_log` not duplicated in `decision_log`, (d) failed approach → `mistakes` with specificity, (e) open question → `open_questions` not `decision_log`
- [ ] T021 [P] [US1] Write empty-field test in `tests/snapshot-extraction.test.ts` — given a mock assistant message with only code implementation (no decisions/mistakes/constraints), verify the extraction produces only `title` and `commit_ref`, all other fields absent (not "None" or "N/A").
- [ ] T022 [P] [US3] Write noise-reduction test in `tests/observation-noise.test.ts` — given a tool call for file read or directory listing, verify no observation is generated. Given a tool call that reveals a genuine gotcha, verify an observation IS generated with exact file path and concept tag.
- [ ] T023 [P] [US3] Write mistake-observation test in `tests/observation-noise.test.ts` — given session content where an approach failed and was corrected, verify a `mistake` type observation is generated with specific detail.

**Checkpoint**: Verify all tests FAIL (Red phase) before proceeding to implementation.

### Implementation (makes tests pass)

- [ ] T024 [US1][US3] Copy `plugin/modes/code.json` to `plugin/modes/agent-workflow.json` — remove `discovery` from `observation_types`, add `mistake` type with description and emoji, add `final-decision` and `mistake-pattern` concepts
- [ ] T025 [US1][US3] Rewrite `summary_instruction` prompt in `agent-workflow.json` — replace old XML template (`request`, `investigated`, `learned`, `completed`, `next_steps`, `notes`) with new structured template (`title`, `decision_log`, `decision_trade_offs`, `constraints_log`, `mistakes`, `gotchas`, `commit_ref`, `open_questions`, `unresolved`). Include explicit instructions: "If a field has nothing meaningful, omit it entirely. Never fill with filler like None or N/A."
- [ ] T026 [US1] Add decision reversal instruction to prompt — "If multiple decisions on the same topic occurred, record only the final decision. Note the reversal explicitly. Do not list superseded decisions as co-equal."
- [ ] T027 [US3] Update `recording_focus` in `agent-workflow.json` — remove all discovery guidance, add file path precision rule ("Always include exact full file paths, never vague descriptions"), add mistake detection signals ("Watch for failed approaches, errors, reversed directions")
- [ ] T028 [US3] Update `skip_guidance` in `agent-workflow.json` — add "Do not log routine file reads or directory listings. Only log file-related observations when something genuinely non-obvious is discovered."
- [ ] T029 [US1] Update `src/sdk/prompts.ts` — modify `buildSummaryPrompt()` to use the new XML template fields when mode is `agent-workflow`. Ensure the prompt tells the extraction agent to map observations to the correct snapshot fields (FR-016).
- [ ] T030 Switch provider — update `~/.claude-mem/settings.json`: set `CLAUDE_MEM_MODE` to `agent-workflow`, set `CLAUDE_MEM_GEMINI_MODEL` to `gemini-2.5-flash`
- [ ] T031 [US1][US3] Run extraction tests — verify T020-T023 now PASS (Green phase)

- [ ] T032 [Checkpoint] Create implementation summary documenting Story 1 + Story 3 work
- [ ] T033 [Checkpoint] Commit work + summary to Git

**Checkpoint**: Structured extraction and noise reduction working. Auto-snapshots produce structured fields. Discovery noise eliminated.

---

## Phase 4: User Story 2 — Manual Snapshot Capture (Priority: P2)

**Goal**: Build `capture_to_mem` MCP tool so users can explicitly capture curated content. Implement flag-and-skip dedup. Reject empty captures.

**Independent Test**: During a conversation, request a manual capture. Verify the record has correct fields, importance 9-10, source='manual', no duplicate auto-snapshot, and empty captures are rejected.

### Tests (MUST write first — verify they FAIL)

- [ ] T034 [P] [US2] Write MCP tool test in `tests/manual-capture.test.ts` — verify `capture_to_mem` creates a record with specified fields, importance 10, source='manual', empty fields omitted
- [ ] T035 [P] [US2] Write dedup test in `tests/manual-capture.test.ts` — verify that when manual capture occurs, the auto-snapshot for the same response cycle is suppressed (exactly one record created)
- [ ] T036 [P] [US2] Write empty-capture test in `tests/manual-capture.test.ts` — verify that calling `capture_to_mem` with no substantive content creates no record in the database

**Checkpoint**: Verify all tests FAIL (Red phase) before proceeding to implementation.

### Implementation (makes tests pass)

- [ ] T037 [US2] Add `capture_to_mem` tool definition to `src/servers/mcp-server.ts` — accepts structured fields (title, decision_log, decision_trade_offs, constraints_log, mistakes, gotchas, commit_ref, open_questions, unresolved), auto-sets importance=10 and source='manual'
- [ ] T038 [US2] Add manual capture HTTP endpoint to `src/services/worker/http/routes/SessionRoutes.ts` — `POST /api/sessions/manual-capture` accepting structured fields, validates content is substantive (FR-015), stores via `storeSummary()`
- [ ] T039 [US2] Implement flag-and-skip dedup in `src/cli/handlers/summarize.ts` — before triggering auto-snapshot, check if a manual capture was already stored for this response cycle. If so, skip the auto-snapshot. (FR-006)
- [ ] T040 [US2] Run manual capture tests — verify T034-T036 now PASS (Green phase)

- [ ] T041 [Checkpoint] Create implementation summary documenting Story 2 work
- [ ] T042 [Checkpoint] Commit work + summary to Git

**Checkpoint**: Manual capture working. Users can say "capture this" and get a high-fidelity record.

---

## Phase 5: Context Injection & Viewer

**Purpose**: Ensure new structured fields flow through to context injection and are visible in the viewer.

### Tests

- [ ] T043 [P] Write context injection test in `tests/context-injection.test.ts` — verify `SummaryRenderer` renders new fields in the injected context block, old records with null new fields render without errors
- [ ] T044 [P] Write viewer rendering test in `tests/viewer-render.test.ts` — verify `SummaryCard` component displays new structured fields, manual captures are visually distinguishable

### Implementation

- [ ] T045 Update `src/services/context/sections/SummaryRenderer.ts` — render new structured fields (`decision_log`, `constraints_log`, `mistakes`, `gotchas`, `open_questions`, `unresolved`, `commit_ref`, `decision_trade_offs`) in the context injection output. Handle null fields gracefully (omit, don't show empty).
- [ ] T046 Update `src/services/context/ObservationCompiler.ts` — update summary query column list to include new fields
- [ ] T047 [P] Update `src/services/context/types.ts` — update `SessionSummary` interface with new fields
- [ ] T048 Update `src/ui/viewer/components/SummaryCard.tsx` — display new structured fields in the viewer card. Show manual captures with a visual indicator (e.g. badge or colour based on `source` field). Handle null/absent fields gracefully.
- [ ] T049 [P] Update `src/ui/viewer/types.ts` — update viewer type definitions with new fields
- [ ] T050 Run context injection and viewer tests — verify T043-T044 PASS

- [ ] T051 [Checkpoint] Create implementation summary documenting context injection & viewer work
- [ ] T052 [Checkpoint] Commit work + summary to Git

**Checkpoint**: Full pipeline working — extraction → storage → injection → viewer

---

## Phase 6: End-to-End Validation & Polish

**Purpose**: Run real sessions, validate all acceptance scenarios, clean up

- [ ] T053 Run a real Claude Code session with decisions, trade-offs, and a standing rule — verify structured snapshot in DB matches Story 1 acceptance scenarios
- [ ] T054 Run a real session with a mistake (try wrong approach, correct it) — verify `mistakes` field and `mistake` observation are populated with specific detail
- [ ] T055 Run a real session with only code implementation (no decisions) — verify empty fields are absent, only `title` and `commit_ref` populated
- [ ] T056 Run a real session and manually capture content ("capture this to agent-mem") — verify manual capture record with importance 10, source='manual', no duplicate auto-snapshot
- [ ] T057 Verify file reads produce no discovery observations in the viewer
- [ ] T058 Verify all file references in observations contain exact paths (query DB for vague patterns)
- [ ] T059 Start a new session on the same project — verify injected context contains the new structured fields from prior session
- [ ] T060 Verify old snapshots (pre-migration) still display correctly in the viewer

- [ ] T061 [Checkpoint] Create implementation summary documenting E2E validation results
- [ ] T062 [Checkpoint] Commit work + summary to Git

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify environment
- **Foundational (Phase 2)**: Depends on Setup — schema BLOCKS all stories
- **Stories 1+3 (Phase 3)**: Depends on Phase 2 — mode + prompt + provider
- **Story 2 (Phase 4)**: Depends on Phase 2 (schema) — can run in parallel with Phase 3 if needed
- **Context/Viewer (Phase 5)**: Depends on Phase 3 (new fields must be populated)
- **E2E (Phase 6)**: Depends on all previous phases

### User Story Dependencies

- **US1 + US3 (P1)**: Implemented together (shared mode/prompt). Can start after Phase 2.
- **US2 (P2)**: Independent of US1/US3 implementation. Needs schema only (Phase 2).
- **Phase 4 (US2) can run in parallel with Phase 3 (US1+US3)** if two agents work concurrently.

### Within Each Phase

- Tests subsection FIRST — write all tests, verify they FAIL
- Implementation subsection AFTER — make tests pass
- Checkpoint at end — summary + commit

### Parallel Opportunities

Within Phase 2: T010-T015 (type updates) can all run in parallel — different files, no dependencies
Within Phase 3 tests: T020-T023 can all run in parallel
Within Phase 4 tests: T034-T036 can all run in parallel
Phase 3 and Phase 4 can run in parallel (different story implementations)

---

## Implementation Strategy

### MVP First (Stories 1 + 3)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Schema & types (BLOCKS everything)
3. Complete Phase 3: Stories 1 + 3 (structured fields + noise reduction)
4. **STOP and VALIDATE**: Run a real session, inspect DB
5. This is the MVP — auto-snapshots now produce structured, high-signal output

### Incremental Delivery

1. Setup + Schema → Foundation ready
2. Stories 1+3 → Test with real session → MVP
3. Story 2 → Manual capture working → Full Phase 1
4. Context injection + viewer → Full pipeline visible
5. E2E validation → Confidence to deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [US1][US3] combined label means the task serves both stories (shared mode/prompt)
- [Checkpoint] tasks = explicit summary + commit steps
- Stories 1 and 3 are co-implemented because they modify the same mode file and prompt
- Story 2 is fully independent and could be implemented by a separate agent
- Old `code.json` mode is NOT deleted — it remains as fallback
- Provider switch (gemini-2.5-flash) happens in Phase 3 so the prompt is developed on the target model
