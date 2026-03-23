---
Date Created: 2026-03-23T09:49:26+11:00
Date Updated: 2026-03-23T10:58:24+11:00
created_by: Claude Opus
updated_by: Claude Opus
---

# Feature Specification: Phase 1 — Snapshot Fields, Manual Capture & Noise Reduction

**Input**: Redesign the claude-mem snapshot and observation system to produce high-signal, structured memory records that enable AI agents to orient immediately in new sessions.

## User Scenarios & Testing

### User Story 1 - Structured Memory for Agent Orientation (Priority: P1)

As an AI agent beginning a new work session,
I want prior work captured in structured fields covering decisions, trade-offs, constraints, mistakes, and unresolved items,
So that I can orient immediately on what was decided, what failed, and what remains open — without parsing prose.

**Why this priority**: Agents currently search claude-mem and rarely find decisions. The existing generic fields bury actionable information in filler. This is the foundational change that makes all downstream improvements (UI curation, importance scoring, multi-agent support) possible.

**Independent Test**: Run a real Claude Code session that includes at least one decision, one reversal, and one mistake. Inspect the resulting snapshot in the database. The structured fields must contain the right content in the right places, with no filler in fields that should be empty.

**Acceptance Scenarios**:

1. **Given** a session where the agent chose approach A over approach B with stated reasoning, **When** the snapshot is generated, **Then** the `decision_log` contains only the final decision, and `decision_trade_offs` captures what was rejected and why — neither field contains vague summaries like "various options were considered."

2. **Given** a session where an earlier decision was reversed mid-conversation, **When** the snapshot is generated, **Then** the `decision_log` records only the final decision and explicitly notes the reversal — not both the original and reversed decision as co-equal entries.

3. **Given** a session where an approach was tried, failed, and had to be corrected, **When** the snapshot is generated, **Then** the `mistakes` field names the specific failed approach and what went wrong — not a generic statement like "an error was encountered."

4. **Given** a session consisting entirely of code implementation with no decisions, trade-offs, constraints, mistakes, or open questions, **When** the snapshot is generated, **Then** only `title` and `commit_ref` are populated. All other fields are absent — no filler text, no "None", no "N/A."

5. **Given** a session where the user establishes a standing rule ("never use pattern X in this codebase"), **When** the snapshot is generated, **Then** the `constraints_log` captures the rule in actionable form (e.g. "Never use pattern X — causes Y"), and the rule does not also appear duplicated in `decision_log` or `gotchas`.

---

### User Story 2 - Manual Snapshot Capture (Priority: P2)

As a user working with an AI agent,
I want to explicitly request that specific content from our conversation be captured as a high-priority memory record,
So that curated decisions, conclusions, and agreements are preserved with maximum fidelity.

**Why this priority**: The automatic capture system handles the common case, but the highest-value content is what the user deliberately identifies as worth remembering. This directly solves the incident that motivated the project — valuable bullet points from a conversation were lost because there was no way to say "save this."

**Independent Test**: During a conversation, request a manual capture of specific content. Verify the resulting record contains exactly the user-specified content in the correct structured fields, with elevated importance, empty fields omitted, and no duplicate auto-generated record for the same response cycle.

**Acceptance Scenarios**:

1. **Given** a conversation where the user and agent have wrangled a set of decisions and open questions, **When** the user instructs the agent to capture the content as a memory record, **Then** a record is created containing the specified content in the appropriate structured fields (e.g. `decision_log`, `open_questions`), with an importance rating of 9 or 10, and all fields without content are omitted.

2. **Given** both automatic and manual capture are active, **When** a manual capture is performed during a response cycle, **Then** exactly one record (the manual one) is created for that cycle — the automatic capture is suppressed, preventing duplicate records.

3. **Given** a conversation with no substantive content (e.g. only greetings or a single file read with no insights), **When** the user requests a manual capture, **Then** no snapshot record is created in the database, and the agent responds explaining there is nothing meaningful to capture.

4. **Given** a manual capture has been stored, **When** the record is later retrieved by search or timeline, **Then** the record is distinguishable as user-curated (not auto-extracted), and its elevated importance causes it to surface ahead of lower-importance automatic snapshots.

---

### User Story 3 - Noise Reduction and Observation Quality (Priority: P1)

As an AI agent receiving injected context from prior sessions,
I want the memory system to exclude routine file-read noise, require precision in what it captures, and recognise mistakes as a distinct category,
So that my injected context is high-signal and I can orient on what matters without wading through filler.

**Why this priority**: Equal to Story 1. Without this, the new structured fields from Story 1 get filled with the same low-quality content. Discovery observations are the single largest source of noise in the current system. This story ensures the content flowing into the structured fields is actually valuable.

**Independent Test**: Run a Claude Code session that involves reading several files, making a decision, and encountering an error. Inspect the resulting observations and snapshot. Verify no discovery cards were generated for file reads, all file references use exact paths, the snapshot contains no filler, and the error was captured as a mistake observation.

**Acceptance Scenarios**:

1. **Given** Claude reads a file or lists a directory during a session, **When** the memory observer processes the tool call, **Then** no observation is generated for that action alone — routine exploration produces no memory records.

2. **Given** an observation is generated that references a file, **When** the observer writes the narrative, **Then** the observation contains the exact full file path (e.g. `src/services/sqlite/SessionStore.ts`) and never a vague description like "a TypeScript file in the services directory."

3. **Given** a snapshot is generated and a field has no meaningful content for this response cycle, **When** the snapshot is written, **Then** that field is omitted entirely — not filled with filler like "Nothing significant" or "No decisions were made."

4. **Given** Claude takes a wrong approach, hits an error, or the user reverses a direction, **When** the observer processes the session content, **Then** a `mistake` observation is generated naming the specific failed approach and what went wrong — not a generic description.

5. **Given** a file read has exposed a non-obvious constraint or architectural trap (e.g. a config file that silently overrides CLI flags), **When** the observer processes the tool output, **Then** an observation of type `change` or `decision` is created with concept tag `gotcha` or `pattern`, containing the exact file path and the specific insight — no `discovery` type observation is created.

---

### Edge Cases

- What happens when the extraction agent hallucinates a decision that was discussed but never actually made? The `open_questions` field exists for this — discussed-but-unresolved items belong there, not in `decision_log`.
- What happens when content could reasonably belong in multiple fields (e.g. a constraint that was also a decision)? If it is a standing rule going forward, it is a constraint. If it was a one-time choice, it is a decision.
- What happens when the extraction agent cannot determine whether a decision was final or tentative? It should go in `open_questions`, not `decision_log`. When in doubt, classify as open.
- What happens when a manual capture is requested but automatic capture has already fired for the same response? The manual capture takes precedence; the auto-capture should be suppressed before it fires, not cleaned up after.
- What happens when the user says "capture this" but refers to content from several turns ago, not the last response? The agent should use its conversation context to identify and structure the relevant content regardless of how many turns back it occurred.

## Requirements

### Functional Requirements

- **FR-001**: The snapshot system MUST support structured fields: `title`, `decision_log`, `decision_trade_offs`, `constraints_log`, `mistakes`, `gotchas`, `commit_ref`, `open_questions` (pending decisions and unresolved research), `unresolved` (dangling state and interrupted work — distinct from `open_questions` in that these are tasks or threads left mid-flight, not decisions awaiting an answer).
- **FR-002**: The snapshot system MUST omit any field that has no meaningful content for a given response cycle — no filler, placeholders, or "N/A" values.
- **FR-003**: When multiple decisions on the same topic occur in a session, the snapshot MUST record only the final decision and note the reversal explicitly.
- **FR-004**: The system MUST support a manual capture mechanism that the user can invoke during conversation to store curated content directly.
- **FR-005**: Manual captures MUST be assigned an importance rating of 9 or 10 automatically.
- **FR-006**: Manual captures MUST suppress the automatic snapshot for the same response cycle to prevent duplicate records.
- **FR-007**: Manual captures MUST be distinguishable from auto-extracted snapshots (e.g. via a `source` field).
- **FR-008**: The system MUST NOT generate observations for routine file reads or directory listings (the `discovery` observation type is removed).
- **FR-009**: All observations that reference files MUST include exact, full file paths — never vague descriptions.
- **FR-010**: The system MUST support a `mistake` observation type for capturing failed approaches, errors, and reversed directions with specific detail.
- **FR-011**: When a file read reveals something genuinely non-obvious, it MUST be captured under a surviving observation type with an appropriate concept tag (e.g. `gotcha`, `pattern`) — not lost because `discovery` was removed.
- **FR-012**: Each snapshot MUST include a `title` field providing a navigable one-line name.
- **FR-013**: The database schema MUST include `importance INTEGER DEFAULT 5` and `hidden_fields TEXT` columns as scaffolding for future phases (importance scoring and checkbox curation).
- **FR-014**: The system MUST switch the snapshot generation provider from `gemini-2.5-flash-lite` to `gemini-2.5-flash` for improved extraction quality.
- **FR-015**: The system MUST NOT create a manual capture record when there is no substantive content to preserve. The agent must decline and inform the user rather than producing an empty or filler record.

### Key Entities

- **Snapshot**: A structured memory record generated after each Claude response, stored in `session_summaries`. Contains the structured fields defined in FR-001.
- **Observation**: A memory record generated during a session from tool calls. Has a type (bugfix, feature, refactor, change, decision, mistake) and concept tags (how-it-works, gotcha, pattern, trade-off, etc.).
- **Mode**: A configuration defining which observation types and concepts are active, plus all prompt text for the extraction agent. The custom `agent-workflow` mode replaces the default `code` mode.
- **Manual Capture**: A user-initiated snapshot that bypasses the extraction agent. The primary conversation agent structures the content directly. Marked with elevated importance and a `source` indicator.

## Success Criteria

### Measurable Outcomes

- **SC-001**: When an agent searches for a past decision, the `decision_log` field surfaces it directly — agents no longer need to parse prose to find decisions.
- **SC-002**: Discovery observation cards no longer appear in the viewer for routine file reads and directory listings.
- **SC-003**: A user can say "capture this" during a conversation and have the content stored as a high-priority memory record within the same response cycle.
- **SC-004**: Snapshot fields with no meaningful content are absent from the stored record — no filler text exists in the database.
- **SC-005**: All file references in observations contain exact paths, verifiable by querying the database for vague patterns like "a file" or "a TypeScript file."
- **SC-006**: Mistake observations are generated when approaches fail, with enough specificity that a future agent reading the observation would not retry the same approach.
