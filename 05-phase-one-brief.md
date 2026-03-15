# Agent-Mem — Phase 1 Detailed Brief

*Phase 1 goal: Learn the codebase, create a custom mode, update what gets captured in snapshots, and cut the noise. No UI changes.*

---

## Context for Executing Agent

Before starting, read:
- `01-project-summary.md` — what this project is
- `04-research-findings.md` — how claude-mem works internally
- `06-summary-quality-analysis.md` — why we're making these changes

The installed repo is at:
`~/.claude/plugins/marketplaces/thedotmack/`

The source is at:
`~/.claude/plugins/marketplaces/thedotmack/src/`

Modes live at:
`~/.claude/plugins/marketplaces/thedotmack/plugin/modes/`

---

## Terminology Note

Claude-Mem calls these "session summaries". We do not use that term. The Stop hook fires after every Claude response — not at session end. A long session can produce dozens of these. They are **snapshots**: point-in-time captures of what just happened. We name them accordingly throughout this codebase.

---

## Task 1 — Create a Custom Mode

Copy `plugin/modes/code.json` to `plugin/modes/agent-workflow.json`.

This is the primary lever for Phase 1. All prompt and observation type changes happen here, not in core code.

### Observation Types — Keep

| Type | Keep? | Reason |
|---|---|---|
| `decision` | ✅ Yes | Core value — captures architectural choices |
| `bugfix` | ✅ Yes | Captures what went wrong and was fixed |
| `feature` | ✅ Yes | Captures what was built |
| `change` | ✅ Yes | Captures config, docs, misc changes |
| `discovery` | ❌ Remove | Low signal — just logs file reads and exploration |
| `refactor` | ⚠️ Optional | Keep if useful, but low priority |

**Discovery cards are to be removed from the mode.** They currently generate the most noise — they log whenever Claude reads a file, producing cards like "User opened file X" with facts that just restate what happened. Zero value for a future agent.

### New Observation Type — Add

Add `mistake` as a new observation type:

```json
{
  "id": "mistake",
  "label": "Mistake",
  "description": "Something that went wrong, an incorrect approach taken, or a direction that had to be reversed",
  "emoji": "⚠️",
  "work_emoji": "⚠️"
}
```

### Observation Concepts — Keep/Add

Keep existing concepts. Add:
- `final-decision` — marks when a decision supersedes earlier decisions in the same session
- `mistake-pattern` — recurring mistake worth flagging globally

---

## Task 2 — Update the Snapshot Prompt

In `agent-workflow.json`, update the `summary_instruction` prompt text and XML fields.

### Current snapshot fields (in `session_summaries` table):
- `request` — what the user asked
- `investigated` — what was explored
- `learned` — what was learned
- `completed` — what shipped/changed
- `next_steps` — what's coming next
- `notes` — misc

### Problems with current fields:
- `investigated` is almost always low value — "I listed some directories"
- No explicit decision capture
- No mistake capture
- No trade-off capture
- Snapshots don't resolve superseded decisions — if three decisions were made in a session and two were reversed, all three appear
- `completed` duplicates git commit messages when commit discipline is good
- `next_steps` is ambiguous — agents can't tell if it means "do this now" or "do this someday"

### New snapshot fields — DB migration required

Add the following columns to `session_summaries` via a new migration:

```sql
ALTER TABLE session_summaries ADD COLUMN decision_log TEXT;
ALTER TABLE session_summaries ADD COLUMN decision_trade_offs TEXT;
ALTER TABLE session_summaries ADD COLUMN constraints_log TEXT;
ALTER TABLE session_summaries ADD COLUMN mistakes TEXT;
ALTER TABLE session_summaries ADD COLUMN gotchas TEXT;
ALTER TABLE session_summaries ADD COLUMN commit_ref TEXT;
ALTER TABLE session_summaries ADD COLUMN open_questions TEXT;
ALTER TABLE session_summaries ADD COLUMN unresolved TEXT;
ALTER TABLE session_summaries ADD COLUMN importance INTEGER DEFAULT 5;
ALTER TABLE session_summaries ADD COLUMN hidden_fields TEXT; -- JSON array for future checkbox support e.g. ["gotchas", "unresolved"]
```

Update the FTS5 virtual table (`session_summaries_fts`) triggers to include the new fields.

### Updated snapshot XML format

Update `buildSummaryPrompt()` in `src/sdk/prompts.ts` AND the mode JSON placeholders to use:

```xml
<summary>
  <title>[One-line human name for this snapshot — used for navigation in the viewer]</title>
  <decision_log>[FINAL decisions only. If multiple decisions were made on the same topic, record only the last one. Format: "Chose X over Y — [reason]". Omit if no decisions were made.]</decision_log>
  <decision_trade_offs>[What was considered and rejected, and why. Omit if no meaningful trade-offs exist.]</decision_trade_offs>
  <constraints>[Standing rules established or reconfirmed in this snapshot — things that apply to all future work on this project. Format: "Always X" or "Never Y". Omit if none.]</constraints>
  <mistakes>[What went wrong, what had to be reversed, what approach failed. Omit if nothing went wrong.]</mistakes>
  <gotchas>[Traps, landmines, or non-obvious things a future agent must know. Omit if none discovered.]</gotchas>
  <commit>[The commit hash or message that corresponds to work done in this snapshot, if applicable. Omit if no commit was made.]</commit>
  <open_questions>[Decisions that need a future answer — unresolved choices, pending research, things that need a human decision. Omit if none.]</open_questions>
  <unresolved>[Threads started but not finished — dangling state, half-done work, things interrupted. Omit if none.]</unresolved>
</summary>
```

### Fields dropped or changed vs previous design

| Old field | Status | Reason |
|---|---|---|
| `request` | → `title` | Renamed — "request" implies a task, title implies a navigable name |
| `investigated` | ❌ Dropped | Low value — logs file reads, not insights |
| `learned` | ❌ Dropped | Split into `gotchas`, `constraints`, and `decision_log` |
| `completed` | ❌ Dropped | Replaced by `commit` — if commit discipline is good, the commit message is ground truth. A future agent can `git show` it. |
| `next_steps` | ❌ Dropped | Ambiguous — agents can't tell "do now" from "do someday". Replaced by `open_questions` and `unresolved`. |
| `notes` | ❌ Dropped | Dumping ground. Split into `open_questions`, `unresolved`, and `gotchas`. |

---

## Task 3 — Update the Observation Prompt

In `agent-workflow.json`, update `recording_focus` and related prompt sections:

### Key prompt additions:

**On file paths:**
> Always include exact full file paths in narratives and facts. Never write "a markdown file was opened" — write the actual path. The file path is always available in the tool call data.

**On decisions:**
> When a `decision` type observation is made, always note what alternative was considered and rejected. Format: "Chose [X] over [Y] because [Z]." If this decision reverses an earlier decision in this session, note that explicitly.

**On mistakes:**
> When a `mistake` type observation is made, be specific about what went wrong, not vague. Include the exact error, wrong assumption, or failed approach.

**On discovery — remove entirely:**
> Remove all `discovery` type guidance from the prompt. Do not log observations just because a file was read or a directory was listed.

---

## Task 4 — Semantic Signal Detection (Phase 1 Consideration)

*Research task pending — see `02-research-and-discovery.md`. Design below is provisional.*

The current observation system only watches **tool calls** (file reads, shell commands etc.). It does not watch the **conversation content** for meaningful signals from the user.

The following semantic signals in user messages should trigger specific observation types. These should be added to the `recording_focus` section of `agent-workflow.json`:

### Frustration / Pain Signals
Trigger: profanity, "why did you do that", "that's wrong", "undo that", "revert", "go back"
→ Log as `mistake` observation
→ Note: Ostii deliberately swears during sessions as frustration markers — these should be captured as pain point signals, not filtered out

### Decision Reversal Signals
Trigger: "actually", "no wait", "let's go with X instead", "forget that", "change of plan"
→ Log as `decision` observation with `final-decision` concept
→ Explicitly supersede any earlier decision on the same topic in this session

### Confirmation / Approval Signals
Trigger: "perfect", "that's it", "yes that's right", "exactly", "ship it"
→ Flag the preceding completed action as confirmed/approved
→ Useful for distinguishing "done tentatively" from "done and approved"

### Constraint / Rule Signals
Trigger: "never do X", "don't do that again", "always use X", "remember to always"
→ Log as `decision` observation with `pattern` concept
→ Candidates for promotion to global agent rules in Phase 5
→ Map to `constraints` field in snapshot

### Open Question Signals
Trigger: "I'm not sure about X", "we need to decide", "TBD", "research needed"
→ Map to `open_questions` field in snapshot
→ Flag as unresolved so future sessions can pick them up

### Implementation Note
These signals require the memory agent to watch **assistant and user message content**, not just tool calls. This may require changes to what gets passed to the memory agent via the PostToolUse hook, or a new hook that watches message content. **Research required before implementing** — see `02-research-and-discovery.md` task on signal detection.

---

## Task 5 — Architectural Schema Note (for future Phase 3)

The `hidden_fields` column added in Task 2 is intentional scaffolding for the Phase 3 checkbox feature. It stores a JSON array of field names the user has unchecked, e.g. `["gotchas", "unresolved"]`.

When the context injection system queries snapshots to inject into new sessions, it must filter out fields listed in `hidden_fields`. The viewer UI will show these fields greyed out but present.

The `importance INTEGER DEFAULT 5` column is also scaffolding — for future ranking and filtering of snapshots by signal density. Every production agent memory system uses importance scoring; we're planting the column now so it's available when needed.

**Do not build the UI for either of these in Phase 1.** Just ensure the columns exist and the injection query respects `hidden_fields`.

---

## Task 6 — Test & Validate

After making changes:

1. Run a test Claude Code session on a real project
2. Check `localhost:37777` to verify:
   - Discovery cards no longer appear
   - Snapshots show the new fields
   - Decision log captures final decisions only
   - File paths appear in narratives
3. Check `~/.claude-mem/claude-mem.db` to verify the new columns exist in `session_summaries`
4. Verify the FTS5 triggers are working for the new fields

---

## Files to Modify

| File | Change |
|---|---|
| `plugin/modes/agent-workflow.json` | New file — create from code.json |
| `src/sdk/prompts.ts` | Update `buildSummaryPrompt()` XML format |
| `src/services/sqlite/migrations.ts` | Add migration008 with new columns |
| `src/services/sqlite/summaries/types.ts` | Add new fields to TypeScript interfaces |
| `src/services/context/sections/SummaryRenderer.ts` | Render new fields in context injection |
| `src/ui/viewer/components/SummaryCard.tsx` | Display new fields in viewer UI |

---

## Out of Scope for Phase 1

- UI redesign (sidebar, accordions) — Phase 2
- Checkbox curation UI — Phase 3
- Multi-agent support — Phase 4
- Any changes to the MCP server layer
