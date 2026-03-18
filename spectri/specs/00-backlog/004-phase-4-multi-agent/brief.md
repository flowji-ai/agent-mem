---
Date Created: 2026-03-18T17:44:04+11:00
Title: Multi-agent UI and API key rotation
Type: brief
---

# Multi-agent UI and API key rotation

## Problem Statement

Agent-mem currently only captures snapshots from Claude Code sessions. The goal is multi-agent support (Claude, Qwen, Gemini, etc.) but the viewer has no way to distinguish which agent produced a snapshot. Additionally, API credits are consumed quickly on the snapshot generation step — there's no key rotation when quota is exhausted.

## Directional Requirements

- Snapshots from all agents shown in chronological order within a project
- Each snapshot card colour-coded or badged by agent source
- Filter controls at top of project view: "Show only Claude", "Show only Qwen" etc. (multi-select)
- Per-project view only (not global cross-project)
- Support multiple API keys per provider in settings (array of keys)
- Auto-cycle to next key when daily quota is exhausted
- Configured in `~/.claude-mem/settings.json`
- Visual indicator in UI showing which key/provider is currently active

## Context & References

- Depends on Phases 1-3
- Platform adapters: `src/services/integrations/`
- SDK agents: `src/services/worker/SDKAgent.ts`, `GeminiAgent.ts`, `OpenRouterAgent.ts`
- `spectri/research/effective-agent-memory.md` — cross-agent knowledge transfer (cass-memory, Memp paper)
- AGENTS.md Fork Roadmap — Phase 2 (Multi-Agent Support) for adapter work

## Open Questions

- Gemini CLI adapter: how do Gemini CLI lifecycle events map to claude-mem hooks?
- Qwen Code adapter: same question
- Platform detection: auto-detect which CLI is calling vs explicit configuration?
- cass-memory cross-agent playbook sharing — review before designing
