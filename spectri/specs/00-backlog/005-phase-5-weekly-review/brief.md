---
Date Created: 2026-03-18T17:44:05+11:00
Title: Weekly multi-agent review workflow
Type: brief
---

# Weekly multi-agent review workflow

## Problem Statement

Snapshot memory accumulates over time but is never promoted into durable project documentation. Decisions, constraints, and lessons stay trapped in the snapshot store. There's no process to surface high-value content into ADRs, skills, global agent rules, or project docs. Additionally, single-session mistakes can become permanent rules without evidence validation.

## Directional Requirements

- Scheduled or manually triggered review workflow using 3-5 agent consensus model
- Stage 1: Should this snapshot item be promoted to documentation? (agents vote, consensus required)
- Stage 2: What type of document does it belong in? Options: project docs, ADR, skill file, automation script, global agents.md
- Stage 3: User confirms placement
- Stage 4: Content written into the appropriate documentation file
- Evidence gate (from cass-memory): don't accept a rule into standing constraints until multiple snapshots confirm it. Confidence levels: candidate -> established -> proven
- Anti-pattern inversion: if a rule is marked harmful multiple times, auto-invert to a warning
- Global knowledge surfacing: flag items that should become global skills, global rules, or automation scripts
- Temporal decay scoring: memories decay based on importance and recency (18-180 day half-lives)

## Context & References

- Depends on Phases 1-4
- `spectri/research/effective-agent-memory.md` — evidence gates, anti-pattern inversion, confidence decay, procedural memory tiering
- `spectri/research/research-and-discovery.md` — cass-memory cherry-pick reference (evidence gate, trauma guard, maturity levels)
- cass-memory three-layer architecture: episodic -> working -> procedural
- claude-mem PR #1257: temporal scoring with half-lives
- Spectri integration: consider whether claude-mem summaries can replace/supplement manual `/session-summary`

## Open Questions

- How does the consensus model work? Which agents participate, what constitutes quorum?
- Integration with Spectri's ADR and constitution workflows?
- How to handle conflicts between agent votes?
- Relationship to Cognee knowledge graph — should promoted content also feed into Cognee?
