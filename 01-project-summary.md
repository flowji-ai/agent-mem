# Agent-Mem — Project Summary

*This project is a fork of `thedotmack/claude-mem` with significant UI and feature additions tailored to Ostii's multi-project, multi-agent workflow.*

---

## Terminology

Claude-Mem calls these things "session summaries". We do not use that term. The Stop hook fires after every Claude response — not at session end. A long session can produce dozens of them. They are **snapshots**: point-in-time captures of what just happened in a response cycle.

**Naming conventions used in this project:**

| Term | Where used | Meaning |
|---|---|---|
| **snapshot** | Code, DB, docs, functions | The structured memory record generated after each response |
| **card** | UI, viewer, human-facing | How a snapshot is displayed in the viewer interface |
| **session** | General | A single Claude Code conversation window |
| **pod / atom** | Considered alternatives | Not currently used — reserved if a sub-unit concept is needed later |

The upstream codebase uses `session_summaries` in DB table names and `SummaryCard` in the viewer. We leave those untouched in Phase 1 to avoid breaking changes. Our custom terminology is applied in new code, prompts, and documentation.

---

## What is Claude-Mem?

Upstream repo: `github.com/thedotmack/claude-mem`

A Claude Code **plugin** — not just an MCP server. Two components must both be installed and running:

1. **Core plugin** — local worker service on port `37777`, captures session observations via lifecycle hooks
2. **MCP server layer** — exposes memory search tools to Claude so it can query and retrieve past context

**Lifecycle hooks:** SessionStart → UserPromptSubmit → PostToolUse → Summary → SessionEnd

**How snapshots work (current understanding):** Observations are captured throughout a session. After each Claude response, the Stop hook fires and an AI pass generates a structured snapshot from Claude's last message. That snapshot is injected into future sessions as context.

**Storage:**
- SQLite at `~/.claude-mem/claude-mem.db` — tables: `sdk_sessions`, `observations`, `session_summaries`
- ChromaDB vector DB at `~/.claude-mem/vector-db/` — used for semantic search
- Local web viewer at `localhost:37777`

**Current setup:** Ostii is using Qwen for the snapshot generation step, which is consuming Qwen credits quickly.

---

## The Fork — Agent-Mem

This is a standalone project, separate from Spectri. Working name: **agent-mem**.

### Core Design Philosophy

Ostii deliberately keeps chats **short and focused**, then closes them to preserve context. Agent-Mem is built around this pattern — each new session should pick up cleanly and efficiently from the last with minimal overhead. This means:

- Snapshots must be lean and high-signal, not bloated
- The trigger for snapshot generation matters — closing a chat should reliably fire the hook
- Future agents reading these snapshots should be able to orient quickly without large token cost

This philosophy should be embedded in the agent skills files within the project itself.

### Related Project — ChatCatcher

An earlier Ostii project (currently stalled) with overlapping goals: reviewing chats for global rules and patterns to feed back to agents globally. Review ChatCatcher before building to avoid duplicating work and to surface useful patterns.

---

## Notes

- Output folder for this project: `/Users/ostiimac/Forge/primary-vault/04-REPOSITORIES/04-REPOS-flowji-ai/agent-mem/`
- All features in this fork are custom additions — embrace that fully
- See `02-research-and-discovery.md` for open questions
- See `03-feature-specification-brief.md` for phased build plan
