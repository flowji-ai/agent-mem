---
status: open
priority: high
created_by_agent: Claude Opus
created_by_user: ostiimac
opened: 2026-03-22
closed: null
blocked: false
blocker_info: null
spec_needs_update: null
relates_to_this_project: false
target_repo: spectri
related_specs: []
related_tests: []
related_files: []
---

# Issue: Specify Silent No Draft Message

## Issue Summary

spec.specify reports 'No draft session found' on first run, confusing users and derailing workflow — should only mention drafts when a draft file actually exists

## Expected Behaviour

When running `/spec.specify` on a spec for the first time (no prior draft session), the command should proceed silently to story generation without mentioning draft sessions. The draft session check should only produce output when a `.draft-stories.md` file is actually found, offering to resume or start fresh.

## Current Behaviour

The command reports "No draft session found" even on first run. Agents surface this message to the user, causing confusion ("What draft session? We didn't get interrupted.") and derailing the workflow as the user asks questions about what `.draft-stories.md` is and why it's being mentioned.

## Steps to Reproduce

1. Run `/spec.specify` on a spec that has never had the interactive story workflow started
2. Observe the agent reporting "No draft session found" before proceeding
3. User asks "what does that mean?" — workflow derailed

## Proposed Fix

In the `/spec.specify` command (step 3a "Check for existing draft session"), change the logic from report-always to report-only-when-found:

- **If `.draft-stories.md` exists**: Show the resume/start-fresh prompt (current behaviour, keep this)
- **If `.draft-stories.md` does not exist**: Proceed silently to story generation — no message, no mention of drafts

## Tasks

<!-- Tasks are filled in by the agent resolving the issue, not at logging time. -->

- [ ]

## Resolution

[Filled when resolved]
- Commit(s):
- Spec updates required: [Yes/No]
- Specs updated: [list spec numbers if applicable]
- Notes:
- Implementation summary: [path if created]
