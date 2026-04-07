---
Date Created: 2026-04-07T18:32:50+10:00
Title: Add semver versioning convention to agent-mem
Type: notes
---

# Add semver versioning convention to agent-mem

Upstream claude-mem uses version numbers in package.json (currently 10.5.5). Our fork needs its own versioning that:

- Tracks our fork's changes separately from upstream
- Integrates with git tags for release tracking
- Relates to DB migration version numbers (currently at version 23, next is 24)
- Follows semver convention (major.minor.patch)

User requested during Phase 1 implementation session. Not blocking current work — capture for later.
