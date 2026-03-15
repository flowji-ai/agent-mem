# Agent-Mem — Feature Specification Brief

*Phased build plan for the agent-mem fork of `thedotmack/claude-mem`.*

---

## Terminology Note

Claude-Mem calls these "session summaries". In this project they are **snapshots** — point-in-time captures generated after each Claude response, not at session end. In the viewer UI they are displayed as **cards**. See `01-project-summary.md` for full terminology table.

---

## Phase 1 — Learn the App & Update Snapshot Template (MVP)

**Goal:** Understand how Claude-Mem works from the inside, then update what gets captured in snapshots and how it's structured. Low risk, high learning value. No UI changes yet.

### Tasks
- Complete all research tasks in `02-research-and-discovery.md` before building
- Identify where the snapshot prompt lives in the codebase
- Replace generic bullet point snapshot with structured fields:

| Field | Description |
|---|---|
| **Title** | One-line human name for this snapshot — used for navigation |
| **Decision Log** | Final decisions only. Must resolve superseded decisions within the same chat — only the last decision on any topic is captured |
| **Decision Trade-offs** | "We chose A over B because X" — captures directional reasoning |
| **Constraints** | Standing rules established or reconfirmed — apply to all future work on this project |
| **Mistakes** | What went wrong, what had to be reversed, what approach failed |
| **Gotchas** | Traps or non-obvious things a future agent must know |
| **Commit** | The commit hash or message corresponding to work done in this snapshot |
| **Open Questions** | Decisions that need a future answer — unresolved choices, pending research |
| **Unresolved** | Threads started but not finished — dangling state, interrupted work |

- Ensure snapshot prompt is configurable without requiring code changes (if possible)
- Validate output looks correct in the existing viewer

### Architectural Note
Even though the checkbox curation feature (Phase 3) is not being built yet, the DB schema must be designed from this phase to support a future relevance flag on snapshot items. Do not build the UI for it — just ensure the schema has room for it.

### Out of Scope
- No UI changes
- No new pages or navigation
- No multi-agent support

---

## Phase 2 — UI Redesign

**Goal:** Replace the flat list viewer with a structured, navigable interface organised by project and time.

### Left Sidebar — Project Navigation
- Replace flat list with a scrollable left sidebar supporting 20–30+ projects
- Three categories within the sidebar:
  - **Today** — projects with session activity today
  - **Last Week** — projects active within the last 7 days
  - **Inactive** — projects not touched in over 7 days
- Clicking a project loads its session history in the main content area

### Project View — Snapshot Cards / Accordions
- Each snapshot displayed as a collapsible accordion card
- Accordion header shows: date stamp + snapshot title + token count
- Snapshot title has two states:
  - Auto-generated title (from the `title` field in the snapshot)
  - User override — user can manually rename and save a custom title
- **Expand All** button — opens every accordion so user can scroll full project history in one continuous view
- PROMPT cards hidden by default; DISCOVERY cards hidden entirely
- Add toggle to reveal PROMPT cards when needed

### Design Principles
- Clean, fast, minimal
- Must work well as a local browser tool (no login, no auth)
- Sidebar collapse/expand for more reading space

---

## Phase 3 — Checkbox Curation & Relevance Flagging

**Goal:** Give users control over what gets injected into future sessions.

### Checkboxes on Snapshot Fields
- Each field in a snapshot card gets a checkbox
- All checkboxes default to **on** when snapshot is first generated
- User can uncheck any field
- Unchecked fields: **excluded from future agent injection** but **remain visible in the UI** (greyed out) so user can audit their own decisions
- `hidden_fields` JSON column (added in Phase 1) stores the array of unchecked field names

### DB Architecture
- Queries for context injection filter out fields listed in `hidden_fields`
- Viewer queries show all fields regardless, with visual distinction for hidden ones

---

## Phase 4 — Multi-Agent UI & Multi-API Key Rotation

**Goal:** Support multiple AI agents in the workflow and handle API quota limits gracefully.

### Multi-Agent Session View
- Snapshots from all agents (Claude, Qwen, Gemini, etc.) shown in **chronological order** within a project
- Each snapshot card colour-coded or badged by agent
- Filter controls at top of project view: "Show only Claude", "Show only Qwen", etc. (multi-select)
- Per-project view only (not global across all projects)

### Multi-API Key Rotation
- Support multiple API keys per provider in settings (array of keys)
- Auto-cycle to next key when daily quota is exhausted
- Configured in `~/.claude-mem/settings.json`
- Visual indicator in UI showing which key/provider is currently active

---

## Phase 5 — Weekly Multi-Agent Review Workflow

**Goal:** Promote curated snapshot content into official project documentation and global agent knowledge.

### Review Pipeline
A scheduled or manually triggered workflow using a 3–5 agent consensus model:

- **Stage 1:** Should this snapshot item be promoted to documentation? (agents vote, consensus required)
- **Stage 2:** What type of document does it belong in? Options: project docs, architectural decision record (ADR), skill file, automation script, global agents.md
- **Stage 3:** User confirms placement
- **Stage 4:** Content written into the appropriate documentation file

### Evidence Gate (from cass-memory)
Don't accept a rule into standing constraints until multiple snapshots confirm it. Prevents single-session mistakes from becoming permanent rules. Confidence levels: candidate → established → proven.

### Global Knowledge Surfacing
- As part of the review process, agents also flag items that should become:
  - A global skill (added to agent skills library)
  - A global rule (added to `agents.md` or equivalent)
  - A new automation script to prevent recurrence of a mistake

---

## Phase 6 — Team Collaboration & Shared Memory

**Goal:** Allow multiple users on a team to share project memory so agents have continuity regardless of who worked last.

### Approach (TBD)
- Currently single-user per machine
- Shared memory likely requires a cloud-based or network-accessible DB layer
- Key challenge: conflict resolution when two users have conflicting or overlapping snapshots
- Each user has a local instance; a sync/merge process brings shared project memory together

### Notes
- This is the most architecturally complex phase
- Do not attempt until Phases 1–4 are stable and the data model is well understood
- Review ChatCatcher and any community approaches to multi-user agent memory before designing

---

## Future / Backlog Ideas

- **Frustration signals:** Ostii intentionally swears during sessions to mark frustration. Post-MVP, an agent could scan session transcripts for these markers and surface patterns about recurring failure points
- **Manual entry:** Allow user to manually add an observation or note to a session
- **Search across projects:** Global search across all snapshots
- **Session sidebar search/filter:** When project list grows large, add search or tag filtering to the sidebar
