# Agent-Mem — Research & Discovery Tasks

*These are open questions that need to be answered before or during building. Some are agent research tasks, some require reading the source code directly.*

---

## 1. Summary Trigger Point
**Question:** Exactly when and how is the snapshot generated?
- Is it triggered by closing the Claude Code window?
- Is it a slash command the user runs?
- Is it an automatic hook that fires on session end?
- Can it be triggered manually mid-session?

**Status:** Answered in `codebase-research-findings.md`. The Stop hook fires after every Claude response — not at session end. This is why we call these **snapshots**, not session summaries.

---

## 2. Existing Snapshot Fields & DB Schema
**Question:** What fields does Claude-Mem currently capture and store in `session_summaries`?

**Status:** Answered. Current fields: `request`, `investigated`, `learned`, `completed`, `next_steps`, `notes`. See `../specs/00-backlog/001-phase-1-snapshot-fields/phase-one-detailed-brief.md` for full replacement schema.

---

## 3. Summarisation Mechanism & Prompt
**Question:** How does Claude-Mem generate the snapshot?

**Status:** Answered in `codebase-research-findings.md`. The secondary AI agent (Qwen in Ostii's setup) receives `buildSummaryPrompt()` from `src/sdk/prompts.ts` and returns XML. Summary is generated from Claude's last assistant message only — not the full transcript.

---

## 4. Context Injection Mechanism
**Question:** How does Claude-Mem inject past context into a new session?

**Status:** Answered. SessionStart hook fires on `startup|clear|compact` → `context-generator.cjs` → queries recent snapshots and observations → progressive disclosure. Token budgets managed by `TokenCalculator.ts`.

---

## 5. ChromaDB vs SQLite — Roles
**Question:** What is each database actually doing?

**Status:** Answered. SQLite at `~/.claude-mem/claude-mem.db` for structured data. ChromaDB at `~/.claude-mem/vector-db/` for semantic search (optional — SQLite FTS5 fallback available). See `codebase-research-findings.md`.

---

## 6. Current File Outputs
**Question:** What files does Claude-Mem currently write to the filesystem?

**Status:** Partially answered. Viewer React app at `localhost:37777`. SQLite and ChromaDB stores confirmed. CLAUDE.md write behaviour — not fully confirmed, needs verification.

---

## 7. Relevance Flag Architecture (for future checkbox feature)
**Question:** How should we architect the DB schema to support future checkbox curation?

**Status:** Resolved. `hidden_fields TEXT` column added in Phase 1 migration (JSON array of unchecked field names). Injection query filters excluded fields. UI shows them greyed out. See `../specs/00-backlog/001-phase-1-snapshot-fields/phase-one-detailed-brief.md` Task 5.

---

## 8. Deep Research — Effective Agent Memory
**Task:** Research what information is most effective to capture from a chat session to give AI agents useful persistent memory.

**Status:** Complete. See `effective-agent-memory.md`.

Key findings summary:
- Three memory types matter: episodic (what happened), semantic (abstracted facts), procedural (standing rules). Almost nobody does procedural well — that's our gap.
- Reflexion (NeurIPS 2023): storing verbal self-reflection on failures as episodic memory improved coding benchmark accuracy by 14%.
- Mem0 benchmark: selective retrieval achieves 26% higher accuracy, 91% lower latency, 90% token savings vs unfiltered injection.
- Cross-session retention: best current approaches achieve ~37% — genuinely unsolved.
- Post-session (subconscious) capture beats in-session (hot-path) capture. Claude-Mem's architecture is correct.
- Importance scoring is table stakes. Added `importance INTEGER DEFAULT 5` to Phase 1 schema.
- Core principle: **store the lesson, not the event.**

---

## 9. ChatCatcher Review
**Task:** Review the ChatCatcher project and extract anything worth reusing.

**Status:** Pending.

---

## 10. Manual Entry Support
**Question:** Does Claude-Mem support manually adding an observation or note to a session?

**Status:** Not yet investigated. Low priority for Phase 1.

---

## 11. Semantic Signal Detection in Observation Prompt
**Task:** Research how to reliably detect semantic signals (frustration, decision reversals, constraint statements, open questions) from conversation content rather than just tool calls.

**Status:** Provisional design complete — see `../specs/00-backlog/001-phase-1-snapshot-fields/phase-one-detailed-brief.md` Task 4. Implementation approach (prompt-level guidance vs transcript-level scanning) still to be confirmed. Transcript parser already exists at `src/services/transcripts/` — check if it can be leveraged before building anything new.

---

## 12. cass-memory Cherry-Pick Reference

**Repo:** `https://github.com/Dicklesworthstone/cass_memory_system`
**Author:** Jeffrey Emanuel (Dicklesworthstone)
**License:** MIT with OpenAI/Anthropic rider — free for individual use
**Stars:** 273

### Why it doesn't work for Ostii directly
Requires raw `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` for its reflection/curation step. Ostii uses Claude Code's built-in session auth ("localhost"), not bare API keys. Any feature requiring direct LLM API calls is blocked unless routed through an alternative.

### Concepts worth cherry-picking

**Phase 1 — prompt/schema only, no auth needed:**

| Concept | Source | Adopted? |
|---|---|---|
| Diary fields: `accomplishments`, `decisions`, `challenges`, `outcomes` | cass-memory | Informed our field naming (decisions → `decision_log`, challenges → `mistakes`) |
| CONSTRAINTS as a separate field (standing rules vs one-time decisions) | cass-memory | ✅ Adopted — `constraints` field in Phase 1 schema |
| `importance INTEGER DEFAULT 5` column | cass-memory | ✅ Adopted — in Phase 1 migration |
| Anti-pattern inversion: if a decision gets marked wrong multiple times, flip it to a warning | cass-memory | Prompt-level instruction — add to observation prompt in Phase 1 |
| Confidence decay: 90-day half-life, 4x harmful multiplier | cass-memory | Phase 5+ — needs infrastructure |
| Maturity levels: candidate → established → proven | cass-memory | Phase 5+ |

**Phase 2+ — when more infrastructure exists:**

- **Evidence gate:** don't accept a rule into standing constraints until multiple sessions confirm it. Prevents single-session mistakes from becoming permanent rules.
- **Trauma Guard:** scan for apology signals ("sorry", "oops", rollbacks) co-occurring with dangerous commands → register as blocked patterns. Maps to our `mistakes` + `constraints` fields.
- **Cross-agent playbook sharing** — relevant when Phase 4 multi-agent support lands.
- **MCP server mode** (`cm serve` on `127.0.0.1:8765`) — no API key needed for serving, only for the reflection step. Worth checking if this unlocks any cass-memory features without the auth constraint.

### Three-layer architecture (reference model)

1. **EPISODIC** — raw session logs
2. **WORKING** — structured diary entries (accomplishments/decisions/challenges/outcomes)
3. **PROCEDURAL** — validated playbook rules with confidence tracking and decay

Our Phase 1 snapshot schema maps to the working layer. The procedural layer (confidence tracking, decay, evidence gate) is the Phase 5 target.
