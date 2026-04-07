# Plan Completion Review

A whole-plan review conducted after all plan steps are executed and before routing to `resolving-a-plan.md`. This catches issues that per-step execution misses — cross-step consistency, drift from the plan's original intent, and verification gaps.

## When This Applies

After the last plan step is marked complete with execution notes recorded. This review evaluates the **cumulative result** of all steps, not individual changes.

Per-commit code reviews (from `spectri-code-change`) happen during execution. This review is distinct — it assesses the plan as a whole.

## Review Scopes

Every completion review covers these 3 scopes, regardless of which agent runs it. How the sub-agents are launched varies by agent — see the agent-specific sections below.

### Scope 1 — Plan fidelity

Does the implemented result match the plan's stated intent?

- Each plan step's outcome matches its described goal
- No steps were silently skipped or partially completed
- Scope boundaries were respected — nothing was added that the plan did not call for
- If the plan had a Confirmed Decisions section, those decisions were honoured

### Scope 2 — Execution log audit

Is the execution log complete and meaningful?

- Every plan step has a corresponding execution log entry
- Each entry includes verification evidence (not just "done")
- Skipped steps have documented reasons
- Blockers and deviations are recorded, not suppressed
- Commit hashes are present where commits were made

### Scope 3 — Cross-step consistency

Do the individual step results form a coherent whole?

- Changes across steps are consistent with each other (no contradictions between early and late steps)
- Specs updated during execution reflect the final state, not an intermediate state
- No stale references introduced by earlier steps and invalidated by later ones
- Tests added during execution still pass against the final codebase state

## Agent-Specific Instructions

### Claude Code

Launch 3 sub-agents in parallel. Model diversity is preferred: 2 Claude sub-agents + 1 Qwen sub-agent (via PAL MCP server).

| Sub-agent | Scope | Model |
|-----------|-------|-------|
| 1 | Plan fidelity | Claude (native sub-agent) |
| 2 | Execution log audit | Claude (native sub-agent) |
| 3 | Cross-step consistency | Qwen (via PAL `chat` tool) |

**PAL fallback:** If PAL is unavailable (MCP server not running, connection error, or Qwen model not listed), run Sub-agent 3 as a Claude sub-agent instead. Log the fallback in the execution notes. Model diversity improves review quality but must not block plan completion.

For the Qwen sub-agent via PAL, use the `chat` tool with the review scope as the prompt and include the relevant file contents inline — PAL sub-agents cannot read local files directly.

### OpenCode (GLM)

Launch 3 GLM sub-agents in parallel, one per scope. OpenCode does not have PAL access, so all 3 sub-agents run as GLM.

| Sub-agent | Scope | Model |
|-----------|-------|-------|
| 1 | Plan fidelity | GLM (native sub-agent) |
| 2 | Execution log audit | GLM (native sub-agent) |
| 3 | Cross-step consistency | GLM (native sub-agent) |

### Other Agents

If the implementing agent is not Claude Code or OpenCode, launch 3 sub-agents using whatever sub-agent mechanism is available. All 3 scopes must be covered. If the agent cannot launch sub-agents, execute the 3 review scopes sequentially in the main context.

## Providing Context to Sub-agents

Each sub-agent needs:

1. The plan file (with execution log entries)
2. The git log of commits made during plan execution
3. The diff between the branch state before plan execution and now (or the full commit range)

## Handling Review Feedback

After all 3 sub-agents return:

1. **Agree and fix** — create a new commit (do not amend). Record the fix in the execution log.
2. **Disagree and explain** — document why the feedback does not apply. Include this in the execution log.
3. **Escalate** — if the feedback reveals a fundamental problem with the plan's approach, ask the user before proceeding.

Do not route to `resolving-a-plan.md` until all review feedback is addressed.
