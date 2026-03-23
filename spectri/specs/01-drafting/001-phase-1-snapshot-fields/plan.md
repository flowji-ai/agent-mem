---
Date Created: 2026-03-23T11:10:55+11:00
Date Updated: 2026-03-23T12:52:36+11:00
created_by: Claude Opus
updated_by: Claude Opus
---

# Implementation Plan: Phase 1 — Snapshot Fields, Manual Capture & Noise Reduction

**Branch**: `main` | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `spectri/specs/01-drafting/001-phase-1-snapshot-fields/spec.md`

## Summary

Replace claude-mem's generic snapshot fields with structured, decision-oriented fields that enable AI agents to orient immediately in new sessions. Add manual capture via MCP tool. Reduce noise by removing discovery observations and enforcing precision. Switch extraction provider to `gemini-2.5-flash`.

## Approved Implementation Phases

*Approved during planning checkpoint on 2026-03-23. Validated by 5-agent consensus (3 Gemini Pro + 2 Claude).*

1. **Schema & Types**: DB migration (new columns + scaffolding), FTS5 triggers, TypeScript interfaces, parser update, store function update
2. **Mode, Prompt & Provider**: Create `agent-workflow.json` (remove discovery, add mistake, update concepts), rewrite extraction prompt with new XML template, switch to `gemini-2.5-flash`, update settings
3. **Manual Capture**: Build `capture_to_mem` MCP tool + HTTP endpoint, flag-and-skip dedup, importance auto-set, source field, empty content rejection
4. **Context Injection & Viewer**: Update SummaryRenderer for new fields, update SummaryCard.tsx to display new fields, update ObservationCompiler queries
5. **End-to-End Validation**: Run real sessions, verify all stories pass acceptance scenarios, validate viewer output

---

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Express (worker HTTP server), Claude Agent SDK, Gemini API (extraction agent), SQLite (bun:sqlite), ChromaDB (vector search)
**Storage**: SQLite at `~/.claude-mem/claude-mem.db`, ChromaDB at `~/.claude-mem/vector-db/`
**Testing**: Bun test runner (`bun test`), existing tests in `tests/` directory
**Target Platform**: macOS (local Claude Code plugin)
**Project Type**: Single project — Claude Code plugin with worker service
**Performance Goals**: Snapshot generation must complete within the existing 120s Stop hook timeout
**Constraints**: Must not break existing claude-mem functionality. Old snapshots with legacy fields must continue to display (null new fields are acceptable). Must work with Gemini free tier rate limits.
**Scale/Scope**: Single user, local SQLite DB

## Testing Principles

**TDD Mandate** (Article III: Test-First Imperative):

This feature MUST follow test-driven development workflow:
1. Write tests FIRST (contract → integration → e2e → unit)
2. Verify tests FAIL (Red phase)
3. Implement code to make tests pass (Green phase)
4. Refactor as needed

**Test Framework Selection**:

Based on the existing test patterns in `tests/`:
- **TypeScript**: Bun test runner for unit and integration tests
- **Test Organization**: `tests/` directory with flat structure (matching existing convention) plus `tests/integration/` and `tests/sqlite/` subdirectories
- **Coverage Requirements**: Minimum 80% code coverage for new business logic (migration, parser, MCP tool)

**Existing Pattern Detection**:
- Tests use `bun:test` with `describe`/`it`/`expect` pattern
- Integration tests exist at `tests/integration/`
- SQLite-specific tests at `tests/sqlite/`
- Service tests at `tests/services/`
- Naming convention: `[module-name].test.ts`

**Test File Naming Conventions**:
- Unit tests: `[module-name].test.ts`
- Integration tests: `tests/integration/[feature].test.ts`
- SQLite tests: `tests/sqlite/[table-name].test.ts`

**Per-Phase Testing**:
- Phase 1 (Schema): Migration runs cleanly, columns exist, FTS triggers fire, types compile
- Phase 2 (Mode/Prompt): Extraction produces valid XML with new fields, empty fields omitted, discovery suppressed
- Phase 3 (Manual Capture): MCP tool creates record, dedup works, empty capture rejected
- Phase 4 (Context/Viewer): New fields render in injected context, viewer displays them
- Phase 5 (E2E): Real sessions produce correct structured output across the full pipeline

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project constitution (`spectri/constitution.md`) contains only the default template placeholders — no project-specific articles have been defined yet. The Work Cycle foundation (Execute → Document → Update Meta → Commit) is the only active governance principle.

| Principle | Status | Notes |
|-----------|--------|-------|
| Work Cycle (Execute → Document → Update Meta → Commit) | PASS | All phases include commit steps. Implementation summaries required. |
| Article I–V (placeholder) | N/A | Constitution not yet populated for this project. Recommend running `/spec.constitution` before Phase 2 implementation. |

## Project Structure

### Documentation (this feature)

```text
spectri/specs/01-drafting/001-phase-1-snapshot-fields/
├── spec.md                    # Feature specification (complete)
├── plan.md                    # This file
├── brief.md                   # Original brief (historical context)
├── phase-one-detailed-brief.md # Detailed brief (historical context)
├── meta.json                  # Metadata and status
├── implementation-summaries/  # Work documentation
├── assets/                    # Supporting files
└── tasks.md                   # Phase 2 output (created by /spec.tasks)
```

### Source Code (files to modify)

```text
# Phase 1: Schema & Types
src/services/sqlite/migrations.ts          # Add migration008 with new columns
src/services/sqlite/migrations/            # Individual migration files if split
src/services/sqlite/summaries/types.ts     # Update SummaryInput, SessionSummary, etc.
src/services/sqlite/summaries/store.ts     # Update storeSummary INSERT columns
src/sdk/parser.ts                          # Update ParsedSummary interface and parseSummaries()

# Phase 2: Mode, Prompt & Provider
plugin/modes/agent-workflow.json           # NEW — copy of code.json with modifications
src/sdk/prompts.ts                         # Rewrite buildSummaryPrompt() XML template
~/.claude-mem/settings.json                # Update CLAUDE_MEM_MODE and CLAUDE_MEM_GEMINI_MODEL

# Phase 3: Manual Capture
src/servers/mcp-server.ts                  # Add capture_to_mem MCP tool
src/services/worker/http/routes/SessionRoutes.ts  # Add manual capture HTTP endpoint
src/cli/handlers/summarize.ts              # Add flag-and-skip check

# Phase 4: Context Injection & Viewer
src/services/context/sections/SummaryRenderer.ts  # Render new fields in injected context
src/services/context/ObservationCompiler.ts       # Update summary query columns
src/ui/viewer/components/SummaryCard.tsx           # Display new structured fields
src/ui/viewer/types.ts                             # Update viewer type definitions

# Tests
tests/sqlite/migration008.test.ts          # NEW — migration test
tests/snapshot-fields.test.ts              # NEW — structured field extraction tests
tests/manual-capture.test.ts               # NEW — MCP tool and dedup tests
```

**Structure Decision**: Single project structure. All source code under `src/`, tests under `tests/`. This matches the existing claude-mem architecture. No new directories needed — only new files within existing directories.

## Complexity Tracking

No constitution violations to justify. The plan follows existing patterns and adds no new architectural layers.

## Research Notes

No Phase 0 research is required. All technical questions were resolved in the research phase documented at:
- `spectri/research/codebase-research-findings.md` — how claude-mem works internally
- `spectri/research/effective-agent-memory.md` — academic validation of the approach
- `spectri/research/snapshot-quality-analysis.md` — problem analysis driving the field redesign

Key decisions already made:
- **Provider**: `gemini-2.5-flash` (free tier, more capable than flash-lite)
- **Mode approach**: Custom mode file, not core code changes
- **Manual capture**: MCP tool with flag-and-skip dedup
- **Discovery removal**: Remove type, redirect valuable insights to surviving types via concept tags
- **Field naming**: DB columns match FR-001 names (`decision_log`, `constraints_log`, etc.)
