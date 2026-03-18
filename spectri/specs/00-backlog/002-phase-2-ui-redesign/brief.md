---
Date Created: 2026-03-18T17:24:30+11:00
Title: Viewer UI redesign with sidebar and accordion cards
Type: brief
---

# Viewer UI redesign with sidebar and accordion cards

## Problem Statement

The current viewer at `localhost:37777` displays all card types (PROMPT, DISCOVERY, SNAPSHOT) in a flat chronological feed. The most common view is a wall of PROMPT cards with system-injected XML, with useful snapshot cards buried between them. There's no project navigation — all projects mix into one feed. With 20-30+ projects this is unusable.

## Directional Requirements

- Replace flat list with a scrollable left sidebar for project navigation
- Three time-based categories in sidebar: Today, Last Week (7 days), Inactive (>7 days)
- Clicking a project loads its session history in the main content area
- Display snapshots as collapsible accordion cards
- Accordion header: date stamp + snapshot title + token count
- Snapshot title: auto-generated from `title` field, with user-override (rename and save)
- "Expand All" button to open every accordion for continuous scrolling
- Hide PROMPT cards by default; add toggle to reveal when needed
- Hide DISCOVERY cards entirely (removed in Phase 1 mode, but may still exist in historical data)
- Sidebar collapse/expand for more reading space
- Clean, fast, minimal — local browser tool, no login/auth

## Context & References

- Depends on Phase 1 (new snapshot fields must exist first)
- `spectri/research/snapshot-quality-analysis.md` — problems with current viewer
- Viewer component: `src/ui/viewer/components/SummaryCard.tsx`
- Worker/viewer server: `src/services/worker-service.ts`

## Open Questions

- Technology choice for sidebar — extend existing React app or rebuild?
- How to handle historical data that uses old field names?
- Search/filter within sidebar — defer to backlog or include?
