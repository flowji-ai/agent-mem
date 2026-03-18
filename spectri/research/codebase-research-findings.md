# Agent-Mem — Research Findings

*Completed via direct source code analysis of the installed claude-mem repo at `~/.claude/plugins/marketplaces/thedotmack/`*

---

## Terminology Note

Claude-Mem calls these "session summaries". In this project they are **snapshots** — point-in-time captures generated after each Claude response, not at session end. In the viewer UI they are **cards**. The upstream DB table `session_summaries` and component `SummaryCard` are left untouched in Phase 1 to avoid breaking changes. New code and prompts use the snapshot/card terminology.

---

## 1. Snapshot Trigger Point ✅ ANSWERED

**Answer:** Snapshots are triggered by Claude Code's **`Stop` hook** — this fires when Claude finishes responding (the response cycle ends), NOT when the window is closed.

From `plugin/hooks/hooks.json`:
```
"Stop": [
  hook claude-code summarize,
  hook claude-code session-complete
]
```

**What this means for the short-chat philosophy:**
- Every time Claude finishes a response, a snapshot is generated automatically
- You do NOT need to close the window — the Stop hook fires after each completed response
- Short chats will get snapshots reliably without any manual action needed
- A long multi-turn session produces multiple snapshots — one per response cycle

---

## 2. Existing Snapshot Fields ✅ ANSWERED

**The `session_summaries` table has these fields:**

| Field | Description |
|---|---|
| `id` | Auto-increment primary key |
| `memory_session_id` | Links to sdk_sessions |
| `project` | Project name/path |
| `request` | Short title of the user's request + what was discussed |
| `investigated` | What was explored/examined |
| `learned` | What was learned about how things work |
| `completed` | What work was completed / what shipped or changed |
| `next_steps` | What's actively being worked on or coming up next |
| `files_read` | Files read during session |
| `files_edited` | Files edited during session |
| `notes` | Additional insights or observations |
| `created_at` | Timestamp (ISO) |
| `created_at_epoch` | Timestamp (epoch) |
| `discovery_tokens` | Token cost of generating this snapshot (ROI tracking) |

**Key observation:** There is currently no `decision_log`, `mistakes`, `constraints`, or `gotchas` field. The closest thing is `notes`. Our Phase 1 work replaces/extends this schema with more intentional fields.

---

## 3. Snapshot Generation Mechanism ✅ ANSWERED

**How it works:**

1. The `Stop` hook fires when Claude finishes a response
2. It calls `hook claude-code summarize` which hits the worker service
3. The worker takes the `last_assistant_message` (Claude's most recent full response) and sends it to a secondary AI agent (currently Qwen in Ostii's setup)
4. That agent receives the `buildSummaryPrompt()` which instructs it to produce XML in this format:

```xml
<summary>
  <request>...</request>
  <investigated>...</investigated>
  <learned>...</learned>
  <completed>...</completed>
  <next_steps>...</next_steps>
  <notes>...</notes>
</summary>
```

5. The XML is parsed and stored into `session_summaries`

**Critical insight:** The snapshot is generated from **Claude's last assistant message only** — NOT the full conversation transcript. This means:
- It's a point-in-time capture of what Claude said at that moment, not a full session retrospective
- Mid-session superseded decisions may or may not be captured depending on what Claude said last
- This is configurable via the mode's `summary_instruction` prompt

**The snapshot prompt instructs the agent:**
> "Write progress notes of what was done, what was learned, and what's next. This is a checkpoint to capture progress so far. The session is ongoing..."

This confirms snapshots are progress checkpoints after each response, not end-of-session retrospectives.

---

## 4. Context Injection Mechanism ✅ ANSWERED

**How context gets into new sessions:**

The `SessionStart` hook fires on `startup|clear|compact` and calls:
```
hook claude-code context
```

This runs `context-generator.cjs` which:
1. Queries recent `session_summaries` and `observations` for the current project
2. Builds a formatted context block using `ContextBuilder.ts` and `SummaryRenderer.ts`
3. Injects it into the session start

The context uses a **progressive disclosure** approach — recent snapshots get full detail, older snapshots get more compressed summaries. Token budgets are managed by `TokenCalculator.ts`.

**There are also 4 MCP tools** exposed for Claude to actively query memory:
- `search` — semantic search with compact index (~50-100 tokens/result)
- `timeline` — chronological context around a specific timeframe
- `get` — fetch a specific observation by ID
- `details` — get full details of an observation

---

## 5. ChromaDB vs SQLite — Roles ✅ ANSWERED

**SQLite** (`claude-mem.db`) stores:
- All structured data: sessions, observations, snapshots, transcript events
- Used for all standard queries, filtering by project/date, FTS5 full-text search

**ChromaDB** (`vector-db/`) stores:
- Vector embeddings of observations for **semantic similarity search**
- Used when you search by meaning rather than keywords
- The search system uses a `HybridSearchStrategy` that combines both

**For our fork:** ChromaDB is optional — SQLite FTS5 is the fallback. Unless we're building semantic search features, we can largely ignore ChromaDB in Phase 1 and 2.

---

## 6. Current File Outputs ✅ ANSWERED

Claude-Mem writes the following files:

- **`~/.claude-mem/claude-mem.db`** — Main SQLite database
- **`~/.claude-mem/vector-db/`** — ChromaDB vector store
- **`~/.claude-mem/settings.json`** — User settings
- **`~/.claude-mem/worker.pid`** — Worker process PID
- **`~/.claude-mem/.install-version`** — Install cache
- **`CLAUDE.md` files** — Written into project directories containing recent observation snapshots (this is the controversial behaviour from issue #941 — it writes into arbitrary working directories)

The **viewer** at `localhost:37777` is a React app served by the worker, reading directly from SQLite via the HTTP API routes.

---

## 7. Relevance Flag Architecture ✅ ANSWERED

**Recommendation for Phase 1 schema design:**

Add a `hidden_fields` JSON column to `session_summaries`:

```sql
ALTER TABLE session_summaries ADD COLUMN hidden_fields TEXT; -- JSON array e.g. ["gotchas", "unresolved"]
```

This way:
- The existing fields stay intact (no breaking change)
- We can mark individual snapshot fields as hidden without deleting them
- The injection query filters out hidden fields per snapshot
- The viewer can show them greyed out

A migration adds this in Phase 1 even though the checkbox UI won't be built until Phase 3.

---

## 8. Modes System — Key Finding ✅ ANSWERED

**Claude-Mem has a modes system.** The current default is `code.json` — a mode specifically for software development. There's also `email-investigation.json` and `law-study.json`.

Each mode defines:
- Observation types (bugfix, feature, refactor, change, discovery, **decision** ← already exists!)
- Observation concepts (how-it-works, why-it-exists, problem-solution, **trade-off** ← already exists!)
- All prompt text including the snapshot generation instruction

**This is huge for Phase 1:** Rather than modifying the core DB schema, we can create a **custom mode** (`agent-workflow.json`) that changes what gets captured and how snapshots are structured. This is the lowest-risk approach.

---

## 9. Phase 1 Recommendation ✅ RESOLVED

Given the above findings, Phase 1 approach:

1. **Create a custom mode** (`agent-workflow.json`) that:
   - Removes `discovery` observation type (noise)
   - Adds `mistake` observation type
   - Updates snapshot prompt to use the 9-field schema (see `../specs/00-backlog/001-phase-1-snapshot-fields/phase-one-detailed-brief.md`)

2. **Add new fields to `session_summaries`** via migration008:
   - `decision_log`, `decision_trade_offs`, `constraints_log`, `mistakes`, `gotchas`, `commit_ref`, `open_questions`, `unresolved`, `importance INTEGER DEFAULT 5`, `hidden_fields TEXT`

3. **Update FTS5 virtual table** triggers to include new fields

See `../specs/00-backlog/001-phase-1-snapshot-fields/phase-one-detailed-brief.md` for the full detailed brief.

---

## 10. Open Questions Remaining

- **ChatCatcher review** — still needs to be done separately
- **Manual entry support** — not found in source, likely not supported currently
- **Semantic signal detection** — provisional design in `../specs/00-backlog/001-phase-1-snapshot-fields/phase-one-detailed-brief.md`, implementation approach to confirm
