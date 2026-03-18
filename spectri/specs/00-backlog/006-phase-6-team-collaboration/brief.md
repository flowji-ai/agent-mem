---
Date Created: 2026-03-18T17:44:07+11:00
Title: Team collaboration and shared memory
Type: brief
---

# Team collaboration and shared memory

## Problem Statement

Agent-mem is currently single-user per machine. In a team context, agents have no continuity when a different team member picks up work on the same project. Each person's memory store is siloed.

## Directional Requirements

- Allow multiple users on a team to share project memory
- Agents have continuity regardless of who worked last
- Each user has a local instance; a sync/merge process brings shared project memory together
- Conflict resolution when two users have conflicting or overlapping snapshots
- Shared memory likely requires a cloud-based or network-accessible DB layer

## Context & References

- Depends on Phases 1-5 (data model must be well understood and stable)
- Most architecturally complex phase — do not attempt until earlier phases are stable
- Review ChatCatcher and community approaches to multi-user agent memory before designing
- `spectri/research/effective-agent-memory.md` — multi-level memory hierarchies, temporal knowledge graphs
- Pieces sync: export observations to Pieces for cross-tool persistence (potential bridge)

## Open Questions

- Cloud DB vs peer-to-peer sync vs shared filesystem?
- Authentication and access control for shared memory?
- How to merge conflicting snapshot content?
- Privacy: should all snapshots be shared, or can users mark some as private?
- Cost model for cloud storage?
