# Agent-Mem — Research Findings: Effective Agent Memory

*Research conducted via web search (50+ sources), claude-mem GitHub analysis, academic papers, and practitioner systems. March 2026.*

---

## Summary

This document synthesises what the research community, production systems, and practitioner tools have converged on as the most valuable information to capture from AI agent sessions. The findings are organised from most actionable (Phase 1 relevant) to most forward-looking (post-MVP). Our Phase 1 design is well-validated by this research.

---

## 1. The Three Memory Types That Matter

Every serious treatment of agent memory uses the same cognitive-science-derived taxonomy. Understanding it is essential for designing what to capture.

### Episodic Memory — "What happened"
Specific past events, interactions, and their outcomes. Raw session logs are episodic. Most current tools (Mem0, Zep, claude-mem) focus here. It's the ground truth but not always the most actionable form.

### Semantic Memory — "What is known"
Abstracted facts, preferences, user/project context. Derived from episodes. Mem0's "candidate facts" extraction pipeline is semantic memory formation. This is what context injection primarily delivers.

### Procedural Memory — "How to do things" ← Most Underserved
Rules, patterns, workflows, constraints derived from accumulated experience. This is the "lessons learned" layer — not what happened, but what should always/never be done as a result. The Reflexion paper (NeurIPS 2023) is the foundational work here: agents verbally reflect on task feedback signals and store those reflections as episodic memory to guide future decisions. This self-reflective feedback acts as a "semantic gradient" — a concrete direction to improve upon, derived from prior failures.

**Key finding:** Most memory systems focus on episodic and semantic. Procedural is the most underserved and arguably the most valuable for a coding agent context. Our `mistakes` field and the semantic signal detection work (Phase 1) is directly targeting this gap.

---

## 2. What High-Quality Memory Capture Looks Like

### Post-session reflection beats in-session capture
LangMem distinguishes two modes: "hot path" (writing memory during the conversation, adds latency) vs "subconscious" (reflecting on the full conversation after it ends). The subconscious approach produces higher-quality memories because the agent has full context and can reason about what actually mattered — rather than making micro-decisions during the session. Claude-mem uses this pattern correctly (Stop hook fires after session ends).

A practitioner reflection prompt that captures the right things:
```
Review this completed task conversation and extract:
1. Key decisions made and their outcomes
2. User preferences observed
3. Mistakes to avoid in the future
4. Reusable patterns or procedures
```
This maps almost exactly to our Phase 1 field design.

### Selectivity is the core challenge
Every production memory system agrees on one thing: capturing everything is worse than capturing nothing. The challenge is that bad memories actively degrade future performance — contradictory facts, outdated decisions, noise drowning signal. The Medium article "The Memory Problem in AI Agents Is Half Solved" (Feb 2026) puts it bluntly: if five past sessions show the same failure pattern and a retrieval system pulls all five, the agent processes five redundant data points to arrive at one insight, every single session.

The right approach: extract the **lesson** from the episode and store that, not the episode itself. "Never use pattern X for auth in this codebase" is a procedural memory. It's more valuable than a stored session that includes the discovery of that pattern.

### Memory relevance decays — importance scoring is essential
MemoryBank (2023) introduced continual decay and reinforcement for memories. The claude-mem community PR #1257 implements this with half-lives of 18–180 days based on importance score. LangMem explicitly states: "memory relevance is more than just semantic similarity. Recall should combine similarity with importance of the memory and its strength, which is a function of how recently/frequently it was used."

Production numbers from Mem0's research: selecting memories intelligently (rather than full-context replay) achieves 26% higher accuracy on the LOCOMO benchmark vs OpenAI's native memory, 91% lower p95 latency, and 90% token savings. The filtering is doing most of the work.

---

## 3. The Procedural Memory Gap — The Most Important Finding

The February 2026 Medium article "The Memory Problem in AI Agents Is Half Solved" articulates this precisely: most current tools build semantic and episodic memory. What's underserved is **procedural memory** — lessons extracted from outcomes that evolve with new evidence.

The distinction matters because:
- Episodic: "Session 47 involved an auth bug. The fix was X."
- Procedural: "In this codebase, always check token expiry before debugging auth."

The procedural form is reusable across all future sessions. The episodic form requires the agent to re-derive the lesson every time it encounters an auth problem.

### CASS Memory System — Best Practitioner Implementation
The cass-memory system (Dicklesworthstone, GitHub) is the most sophisticated practitioner implementation of procedural memory for AI coding agents. Key design principles:

**Three-layer architecture mirroring human expertise development:**
1. EPISODIC — Raw session logs from all agents (Claude Code, Codex, Cursor, Gemini, etc.)
2. WORKING — Structured playbook bullets derived from episodes
3. PROCEDURAL — Validated, confidence-tracked rules that guide future agent behaviour

**Evidence gate for new rules:** Before a rule joins the playbook, it's validated against session history. "Always check token expiry before auth debugging" only becomes a rule if 4 of 5 relevant sessions confirm it worked. Rules without historical evidence are flagged as candidates, not accepted rules.

**Anti-pattern learning:** When a rule is marked harmful multiple times, it's automatically inverted into an anti-pattern that warns future agents away from the same mistake.

**Trauma Guard / "Hot Stove" principle:** Dangerous patterns (rm -rf /, DROP TABLE, git reset --hard) are detected by scanning session history for dangerous commands combined with apology signals ("sorry", "oops", rollback events). Once registered as trauma, the guard hook blocks future occurrences. This is the most concrete implementation of mistake-based procedural memory in the practitioner space.

**Cross-agent knowledge transfer:** Rules learned in a Claude Code session are immediately available to Codex, Cursor, Gemini on the same codebase. This is the multi-agent memory sharing that our Phase 4 aspirations point toward.

**Relevance to agent-mem:** cass-memory is more sophisticated than claude-mem but also more complex. The evidence-gate and anti-pattern inversion patterns are directly relevant to our Phase 5 multi-agent review workflow. The Trauma Guard concept is a more robust implementation of what our `mistakes` field is trying to achieve at the prompt level.

---

## 4. Reflexion — The Academic Foundation for Mistake Capture

Reflexion (Shinn et al., NeurIPS 2023) is the foundational paper for why mistake capture matters in agent memory. The framework reinforces language agents not by updating model weights, but through **linguistic feedback** stored in an episodic memory buffer.

Key mechanism: after each failed trial, the agent verbally reflects on what went wrong and stores that reflection as additional context for the next attempt. This self-reflective feedback acts as a "semantic gradient" — a natural language description of what went wrong that is more informative than a binary pass/fail signal.

Results on coding benchmarks: Reflexion improved accuracy by 14% on HumanEval Python just from self-analysis of mistakes, without the agent ever seeing the correct answer.

**Why this validates our `mistakes` field:** The core insight is that natural language descriptions of failures are more actionable than just knowing that something failed. "I assumed the user wanted X, but they actually wanted Y — don't make this assumption again" is far more useful than "session failed." Our `mistake` observation type and the `mistakes` summary field are a direct implementation of the Reflexion principle.

**Important limit:** Reflexion operates within single tasks across retries, not across different tasks over time. The Feb 2026 analysis notes this is "the right extraction mechanism pointed at the wrong timescale" — the value compounds when the mistake store carries across sessions and projects.

---

## 5. What the Community Is Building That We're Not (Yet)

### Memory Transferability — Cross-Model and Cross-Agent
The Memp paper (Zhejiang University / Alibaba) found that procedural memory is transferable: memory generated by GPT-4o, given to a much smaller model (Qwen2.5), produced significant performance improvements. This suggests that a well-structured memory store has value independent of which model uses it — and that investing in memory quality compounds across model generations.

For agent-mem: the memory we build should be designed to serve future, better models, not just today's agents.

### Subconscious vs Hot-Path Memory
The industry has converged strongly on background/subconscious memory formation (claude-mem's approach) over in-session hot-path capture. Cross-session retention with the best current approaches is ~37% — so the quality of what gets captured in the background matters enormously.

### Multi-Level Memory Hierarchies
Several systems (MIRIX, MemoryOS) use explicit multi-level hierarchies: working memory, episodic, semantic, procedural — each with different retention policies. The practitioner equivalent is cass-memory's three-layer design. Our Phase 1 is flat (all fields in session_summaries) which is appropriate for now, but a future architecture should consider tiering.

### Temporal Knowledge Graphs (Zep / Graphiti)
Zep's Graphiti library builds temporal knowledge graphs from chat history — capturing not just facts but when they changed, and relationships between entities. This handles the "the user previously preferred X but now prefers Y" problem that flat fact stores can't represent. More complex than we need now, but relevant to Phase 5 (multi-agent review and documentation promotion).

### Importance Scoring Is Table Stakes
Every sophisticated memory system (Mem0, LangMem, MemoryBank, the claude-mem PR #1257) uses importance scoring. The principle: not all memories age at the same rate. Architectural decisions have a 6-month half-life. File exploration notes have a 1-day half-life. Without scoring, older high-value memories get buried by newer low-value ones.

**Action confirmed:** Add `importance INTEGER DEFAULT 5` to `session_summaries` in Phase 1 migration even if unused. It's architecturally essential for any future retrieval quality work.

---

## 6. Semantic Signals — Research Validation

*(See also `05-phase-one-brief.md` Task 4 for implementation design)*

Our proposed semantic signal detection concept is novel — no current memory system implements it. The closest prior art:

**Trauma Guard (cass-memory):** Watches for "apology signals" (sorry, oops, rollback events) co-occurring with dangerous commands and registers them as trauma patterns. This is essentially semantic signal detection, but only for destructive operations.

**Reflexion:** Watches for binary success/failure signals and converts them to verbal reflections. The verbal reflection step is where the signal interpretation happens.

**The gap we're filling:** Neither system watches for the user's *language* in conversation as a signal source — frustration, reversals, approvals, constraints expressed in natural language. This is genuinely novel territory.

The signal table from our Phase 1 brief, validated against research:

| Signal | Trigger | Type | Research Basis |
|---|---|---|---|
| Frustration | Profanity, "why did you", "that's wrong" | `mistake` | Trauma Guard apology signals; Reflexion failure detection |
| Decision reversal | "actually", "no wait", "forget that" | `decision` (final) | LangMem memory update/consolidation on contradiction |
| Approval | "perfect", "ship it", "exactly" | Confirmed action | cass-memory HELPFUL rule signal |
| Constraint / rule | "never do X", "always use Y" | `decision` (pattern) | cass-memory procedural rule formation |
| Open question | "I'm not sure", "TBD" | `notes` | Pre-storage reasoning (arxiv 2025) |

**Implementation note:** Starting with prompt-level guidance is the right Phase 1 approach. The cass-memory Trauma Guard only detects signals in tool outputs (shell commands + apologies), not full conversation content — our semantic approach would actually be more sophisticated. The transcript-level scanning approach (reading JSONL to find user message patterns) is available if prompt-level guidance proves insufficient.

---

## 7. Principles Synthesised From All Sources

These are the principles the research converges on. We should use these as a checklist when evaluating any future memory feature.

**1. Lessons > Events**
Store what was learned, not what happened. "Never use this pattern in this codebase" outlives the session that produced it. Raw events without extracted lessons require re-derivation every time — this is wasted computation.

**2. Procedural memory is the missing layer**
Most tools do episodic and semantic well. Procedural is underserved and provides the highest compounding value over time. Our mistake capture and semantic signal detection directly targets this gap.

**3. Bad memory is worse than no memory**
Contradictory facts, outdated decisions, and noise degrade performance. The cass-memory evidence gate (requiring historical confirmation before accepting rules) is the principled solution. At minimum: always mark old decisions as superseded rather than letting them coexist.

**4. Selectivity requires explicit discard criteria**
Discovery observations (file reads, directory listings) are universally considered noise. Remove them. Every memory system that's been in production for a while eventually adds a "forget" or "mark stale" mechanism.

**5. Subconscious (post-session) capture > hot-path (in-session) capture**
Full session context enables better reflection. No latency penalty. Claude-mem is architecturally correct here.

**6. Importance scoring enables temporal relevance**
Without it, retrieval degrades as the memory store grows. Add the column now even if unused.

**7. Mistakes and failures are as valuable as successes**
Reflexion proves this empirically (14% accuracy improvement from failure analysis alone). The Trauma Guard implements it in production. Most memory systems ignore it entirely.

**8. Memory should transfer across agents and model generations**
Well-structured procedural memory is valuable to any agent that can reason. Design for portability, not just immediate use.

---

## 8. Implications for Our Phase 1 — Fully Validated

| Phase 1 Decision | Research Validation |
|---|---|
| Remove discovery observations | Universal consensus: file-read observations are noise |
| Add `decision_log` field | Most-requested missing feature; maps to episodic→procedural extraction |
| Add `decision_trade_offs` | Essential for the "lesson" vs "event" distinction |
| Add `mistakes` field | Reflexion proves 14% improvement from failure analysis; cass-memory Trauma Guard |
| Semantic signal detection via prompt | Novel; grounded in Reflexion + Trauma Guard principles |
| Final-decisions-only in summary prompt | cass-memory anti-pattern inversion; LangMem contradiction handling |
| Add `importance` column | Every production memory system uses it; required for future retrieval quality |

**One addition from research not yet in Phase 1 plan:**
Add `<private>` tag documentation — claude-mem already supports this, users should know to use it.

---

## 9. Post-MVP Items Confirmed By Research

- **Temporal decay scoring** — claude-mem PR #1257 pattern; MemoryBank; LangMem importance × recency × access-frequency
- **Evidence-gated rule promotion** — cass-memory: rules require historical evidence before entering the playbook
- **Anti-pattern inversion** — cass-memory: harmful rules auto-invert to warnings
- **Drift detection** — claude-mem PR #1257 drift_check; concept areas with high stale % flagged
- **Thinking block capture** — claude-mem PR #1083 (repo owner's own PR); richest signal available when extended thinking is enabled
- **Multi-agent cross-pollination** — cass-memory's core value proposition; our Phase 4
- **Temporal knowledge graphs** — Zep/Graphiti for relationship tracking across time; our Phase 5+
- **Procedural memory tiering** — MIRIX / MemoryOS multi-level hierarchies; future architecture

---

## Sources

- **Academic:** Reflexion (NeurIPS 2023), PRAXIS (arxiv 2511.22074), MACLA (arxiv 2512.18950), Memp (Zhejiang/Alibaba), Agent Memory Survey (Dec 2025), Mem0 research (LOCOMO benchmark)
- **Production systems:** Mem0, LangMem (LangChain), Zep/Graphiti, LlamaIndex Memory, Letta (MemGPT)
- **Practitioner tools:** cass-memory (Dicklesworthstone), claude-mem (thedotmack), Morph Compact
- **Community:** claude-mem GitHub discussions, issues, PRs #1257 (temporal scoring), #1083 (thinking blocks)
- **Practitioner writing:** "The Memory Problem in AI Agents Is Half Solved" (Medium, Feb 2026), LangMem conceptual guide, rushis.com agent memory guide, bdtechtalks agent memory frameworks
