---
Date Created: 2026-03-18T17:33:22+11:00
Title: Checkbox curation and relevance flagging
Type: brief
---

# Checkbox curation and relevance flagging

## Problem Statement

Not all snapshot fields are relevant for future context injection. A decision log from 3 months ago may still be critical; a gotcha from a one-off task may be noise. Currently there's no way for users to curate what gets injected into future sessions vs what's just historical record.

## Directional Requirements

- Each field in a snapshot card gets a checkbox
- All checkboxes default to **on** when snapshot is first generated
- User can uncheck any field
- Unchecked fields: excluded from future agent context injection but remain visible in the viewer UI (greyed out)
- Uses the `hidden_fields` JSON column added in Phase 1 (stores array of unchecked field names e.g. `["gotchas", "unresolved"]`)
- Context injection query must filter out fields listed in `hidden_fields`
- Viewer queries show all fields regardless, with visual distinction for hidden ones

## Context & References

- Depends on Phase 1 (`hidden_fields` column) and Phase 2 (accordion card UI)
- Schema scaffolding: `hidden_fields TEXT` column in `session_summaries` (Phase 1 migration)
- Context injection: `src/services/context/sections/SummaryRenderer.ts`
- `spectri/research/effective-agent-memory.md` — selectivity is the core challenge

## Open Questions

- Bulk curation: should there be a "mark all gotchas as hidden for this project" operation?
- Undo: how to restore a hidden field? Toggle checkbox back on?
