---
Date Created: 2026-03-18T17:24:28+11:00
Title: Custom mode and snapshot field redesign
Type: brief
---

# Custom mode and snapshot field redesign

## Problem Statement

Current claude-mem snapshots are low-signal noise. PROMPT cards show raw user messages with injected system XML. DISCOVERY cards just log file reads ("explored directory X"). The snapshot fields (`request`, `investigated`, `learned`, `completed`, `next_steps`, `notes`) are generic — no structured decision capture, no mistake capture, no trade-off reasoning. Superseded decisions coexist without resolution, confusing future agents. `investigated` is almost always filler, `completed` duplicates git commits, and `next_steps` is ambiguous ("do now" vs "do someday").

A future agent reading these snapshots cannot quickly orient on what was decided, what failed, or what constraints apply. See `spectri/research/snapshot-quality-analysis.md` for the full problem analysis.

## Directional Requirements

- Create a custom mode (`plugin/modes/agent-workflow.json`) copied from `code.json`
- Remove `discovery` observation type (noise) from the mode
- Add `mistake` observation type
- Replace the 6 generic snapshot fields with 9 structured fields:
  - `title` — navigable name for the snapshot
  - `decision_log` — final decisions only (superseded decisions resolved)
  - `decision_trade_offs` — "chose A over B because X"
  - `constraints_log` — standing rules (always/never)
  - `mistakes` — what went wrong, what was reversed
  - `gotchas` — traps future agents must know
  - `commit_ref` — git commit hash/message
  - `open_questions` — pending decisions
  - `unresolved` — dangling state, interrupted work
- DB migration adding new columns + `importance INTEGER DEFAULT 5` + `hidden_fields TEXT` (scaffolding for Phase 3)
- Update FTS5 virtual table triggers for new fields
- Update observation prompt to require exact file paths, explicit trade-offs on decisions, specificity on mistakes
- Add semantic signal detection via prompt guidance (frustration, decision reversals, constraints, open questions)
- Update `buildSummaryPrompt()` in `src/sdk/prompts.ts` with new XML format
- No UI changes — validate output in existing viewer at `localhost:37777`

## Context & References

- `spectri/research/codebase-research-findings.md` — how claude-mem works internally
- `spectri/research/snapshot-quality-analysis.md` — why these changes are needed
- `spectri/research/effective-agent-memory.md` — academic/industry validation (Reflexion, Mem0, cass-memory)
- `spectri/research/research-and-discovery.md` — open questions and their answers
- Upstream repo: `github.com/thedotmack/claude-mem`
- Installed plugin: `~/.claude/plugins/cache/thedotmack/claude-mem/`
- Modes: `plugin/modes/code.json` (template to copy)
- Prompts: `src/sdk/prompts.ts` (`buildSummaryPrompt()`)
- Migrations: `src/services/sqlite/migrations.ts`
- Types: `src/services/sqlite/summaries/types.ts`
- Context renderer: `src/services/context/sections/SummaryRenderer.ts`
- Viewer: `src/ui/viewer/components/SummaryCard.tsx`

## Open Questions

- Semantic signal detection: prompt-level guidance vs transcript-level scanning — confirm approach. Transcript parser exists at `src/services/transcripts/`
- ChatCatcher review pending — check for reusable patterns before building
- Manual entry support — does claude-mem support manually adding observations? (low priority)
