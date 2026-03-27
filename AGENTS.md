<!-- SPECTRI:START -->
@./SPECTRI.md
<!-- SPECTRI:END -->

---
Date Created: 2026-03-10T00:00:00Z
Date Updated: 2026-03-24T00:00:00Z
---

# agent-mem

## Next Session — Start Here

**Status as of 2026-03-24:** Refactoring complete, Phase 1 spec ready, but integration testing required before proceeding.

**Smoke tests passed 2026-03-24:**

1. `bun test` — 1029 pass, 21 pre-existing failures, 0 regressions from refactor
2. Worker boots on port 37777, viewer serves HTML
3. DB has 71 snapshots, including agent-mem sessions with real content (not corrupted)
4. Schema intact (14 columns, unchanged — Phase 1 migration not yet run)

**Next step:** `/spec.implement` against `spectri/specs/01-drafting/001-phase-1-snapshot-fields/`

## Recent Codebase Refactor (2026-03-23)

A 2-plan, 8-step refactoring centralised hardcoded column lists, types, and storage logic across the codebase:
- **Created** `src/services/sqlite/schema/` — single source of truth for all column definitions, SQL helpers, and FTS DDL
- **Consolidated** 11 duplicate type definitions into canonical types with `Pick<>` derivation
- **Replaced** 27 hardcoded column lists (SELECT, INSERT) with central constants
- **Delegated** duplicate `storeSummary()`/`storeObservation()` in SessionStore to modular functions
- **Updated** downstream consumers: ResponseProcessor, ChromaSync, PaginationHelper, SSE types
- **Added** 25 new tests covering schema constants, SQL helpers, storage delegation, and consumer integration
- **Result:** Adding new columns now requires updating 2 files + 1 migration instead of 27+ edits across 15 files

This refactor has NOT yet been integration-tested with a live claude-mem session. The next session must verify it works end-to-end before starting Phase 1.

---

Fork of [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) (v10.5.4, AGPL-3.0).

Goal: extend claude-mem from a Claude Code-only memory system to a multi-agent session memory layer supporting Claude Code, Gemini CLI, Qwen Code, and other AI coding agents.

## Terminology

Claude-Mem calls these "session summaries". We do not use that term. The Stop hook fires after every Claude response — not at session end. A long session can produce dozens of them. They are **snapshots**: point-in-time captures of what just happened in a response cycle.

| Term | Where used | Meaning |
|---|---|---|
| **snapshot** | Code, DB, docs, functions | The structured memory record generated after each response |
| **card** | UI, viewer, human-facing | How a snapshot is displayed in the viewer interface |
| **session** | General | A single Claude Code conversation window |
| **pod / atom** | Reserved | Not currently used — reserved if a sub-unit concept is needed later |

The upstream codebase uses `session_summaries` in DB table names and `SummaryCard` in the viewer. We leave those untouched in Phase 1 to avoid breaking changes. Our custom terminology is applied in new code, prompts, and documentation.

## Design Philosophy

Ostii deliberately keeps chats **short and focused**, then closes them to preserve context. Agent-Mem is built around this pattern — each new session should pick up cleanly and efficiently from the last with minimal overhead. This means:

- Snapshots must be lean and high-signal, not bloated
- The trigger for snapshot generation matters — closing a chat should reliably fire the hook
- Future agents reading these snapshots should be able to orient quickly without large token cost
- This philosophy should be embedded in the agent skills files within the project itself

## Related Project — ChatCatcher

An earlier Ostii project (currently stalled) with overlapping goals: reviewing chats for global rules and patterns to feed back to agents globally. Review ChatCatcher before building to avoid duplicating work and to surface useful patterns.

## Related Project — CASS Memory System

An independent open-source project with significant overlap to both ChatCatcher and Agent Mem's vision. CASS distills AI coding sessions into confidence-scored procedural rules with decay (90-day half-life) and anti-pattern tracking. Three-layer architecture: episodic (raw logs), working (diary entries), procedural (rules in playbooks). Cross-agent from day one. MIT licensed, TypeScript/Bun.

- **Source**: https://github.com/Dicklesworthstone/cass_memory_system
- **Radar entry**: `tool-deck/website/content/tools-radar/cass-memory-system.md`
- **Relevance**: Validates the distillation direction. Confidence/decay model is prior art for Phase 3 rule extraction. Not an integration candidate (different storage architecture) but the rule model is worth studying.

## What This Is

This is a standalone project, separate from Spectri (though Spectri is used for spec management within this repo).

Claude-Mem is a Claude Code **plugin** — not just an MCP server. Two components must both be installed and running:

1. **Core plugin** — local worker service on port `37777`, captures session observations via lifecycle hooks
2. **MCP server layer** — exposes memory search tools to Claude so it can query and retrieve past context

It intercepts every tool call, compresses it using a background AI observer, stores structured observations in SQLite + Chroma, and injects relevant memories back into future sessions.

See the upstream [README.md](README.md) for full documentation on the original system.

## Current Setup (Production)

- **Installed as**: Claude Code plugin via `/plugin install claude-mem@thedotmack`
- **Provider**: Gemini free tier (`gemini-2.5-flash-lite`) — previously used Qwen which consumed credits quickly; switched to Gemini free tier for sustainability
- **Settings**: `~/.claude-mem/settings.json`
- **Database**: `~/.claude-mem/claude-mem.db`
- **Worker**: Express server on `http://127.0.0.1:37777`
- **Viewer UI**: `http://localhost:37777`
- **Upstream tracking**: `upstream/main` remote points to `thedotmack/claude-mem`

## Architecture (Inherited)

- 5 lifecycle hooks (Setup, SessionStart, UserPromptSubmit, PostToolUse, Stop)
- Background worker service (Bun/Express on port 37777)
- SDK agent pipeline with 3 providers (Claude SDK, Gemini, OpenRouter)
- SQLite + Chroma storage with FTS5 full-text search
- MCP server for search/timeline/observation tools
- Platform adapters (Claude Code, Cursor)

## Fork Roadmap

### Phase 1: Enhancements (No Architecture Changes)

1. **Custom summary template** — alter `plugin/modes/code.json` to match our session-summary format (session UUID, agent name, chat title, files changed, key decisions, next priorities)
2. **Session resume link** — surface `content_session_id` in the viewer UI as a `claude --resume <id>` link
3. **First user message capture** — store the first user prompt as a human-readable session label in `sdk_sessions`
4. **Mercury/Qwen provider** — add a `MercuryAgent` or `QwenAgent` following the `OpenRouterAgent` pattern, pointing at local PAL bridge or direct API

### Phase 2: Multi-Agent Support

5. **Gemini CLI adapter** — hook adapter translating Gemini CLI lifecycle events into the same HTTP calls
6. **Qwen Code adapter** — hook adapter for Qwen Code's lifecycle events
7. **Context injection workarounds** — file-based rules injection per platform (following the Cursor precedent)
8. **Platform detection** — auto-detect which CLI is calling and route through the correct adapter

### Phase 3: Integration

9. **Spectri integration** — consider whether claude-mem summaries can replace or supplement manual `/session-summary`
10. **Cognee bridge** — extract entities from observations and feed them into the Cognee knowledge graph
11. **Pieces sync** — export observations to Pieces for cross-tool persistence

## Upstream Sync Strategy

- Keep `upstream/main` remote for pulling upstream changes
- Fork changes go on feature branches, merged to `main`
- Periodically rebase/merge upstream to pick up bug fixes and new features
- Avoid modifying core files where possible — prefer adapter patterns and configuration

## Key Files

| Area | Path |
|------|------|
| Hook handlers | `src/cli/handlers/` |
| Worker service | `src/services/worker-service.ts` |
| SDK agents | `src/services/worker/SDKAgent.ts`, `GeminiAgent.ts`, `OpenRouterAgent.ts` |
| Prompts | `src/sdk/prompts.ts` |
| Mode templates | `plugin/modes/code.json` |
| Storage | `src/services/sqlite/` |
| Context injection | `src/services/context/` |
| MCP server | `src/servers/mcp-server.ts` |
| Platform adapters | `src/services/integrations/` |
| Settings defaults | `src/shared/SettingsDefaultsManager.ts` |
| Installed plugin | `~/.claude/plugins/cache/thedotmack/claude-mem/10.5.4/` |
| Settings | `~/.claude-mem/settings.json` |
| Database | `~/.claude-mem/claude-mem.db` |

## Related

- Upstream: https://github.com/thedotmack/claude-mem
- Cognee capture skill: `04-REPOSITORIES/04-REPOS-Spectri/agent-deck/canonical/skills/cognee-capture-STUB/`
- Session summary command: `~/.claude/skills/session-summary/`
