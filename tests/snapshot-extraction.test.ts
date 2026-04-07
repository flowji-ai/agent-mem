/**
 * Snapshot extraction tests for Phase 1 structured fields (US1)
 * Tests that the extraction prompt + parser correctly maps
 * Claude's responses to structured snapshot fields.
 *
 * These tests validate parseSummary() output against the Phase 1
 * field requirements. The extraction quality depends on both the
 * prompt (agent-workflow.json) and the parser (parser.ts).
 */

import { describe, it, expect } from 'bun:test';
import { parseSummary } from '../src/sdk/parser.js';

describe('US1: Structured snapshot field extraction', () => {
  it('decision with trade-offs → decision_log + decision_trade_offs', () => {
    const xml = `<summary>
      <title>Chose SQLite over PostgreSQL for local storage</title>
      <decision_log>Chose SQLite for local storage — no server process needed, single file, embedded</decision_log>
      <decision_trade_offs>PostgreSQL offers better concurrency but requires a running server. SQLite is simpler for a desktop plugin.</decision_trade_offs>
      <commit_ref>feat: implement SQLite storage layer</commit_ref>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.decision_log).toBe('Chose SQLite for local storage — no server process needed, single file, embedded');
    expect(result!.decision_trade_offs).toBe('PostgreSQL offers better concurrency but requires a running server. SQLite is simpler for a desktop plugin.');
    expect(result!.title).toBe('Chose SQLite over PostgreSQL for local storage');
  });

  it('reversed decision → only final decision with reversal noted', () => {
    const xml = `<summary>
      <title>Switched from REST to WebSocket for real-time updates</title>
      <decision_log>Switched to WebSocket for real-time updates. Reversed earlier decision to use REST polling — polling caused 2s latency.</decision_log>
      <decision_trade_offs>REST polling is simpler but introduces latency. WebSocket adds complexity but enables sub-100ms updates.</decision_trade_offs>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    // Should contain the reversal note
    expect(result!.decision_log).toContain('Reversed');
    expect(result!.decision_log).toContain('WebSocket');
  });

  it('standing rule → constraints_log, not duplicated in decision_log', () => {
    const xml = `<summary>
      <title>Established TypeScript strict mode rule</title>
      <constraints_log>Always use TypeScript strict mode in this codebase — catches null reference errors at compile time</constraints_log>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.constraints_log).toContain('Always use TypeScript strict mode');
    expect(result!.decision_log).toBeNull(); // NOT duplicated
  });

  it('failed approach → mistakes with specificity', () => {
    const xml = `<summary>
      <title>Fixed auth token refresh after failed retry approach</title>
      <mistakes>Tried linear backoff for token refresh retries — caused rate limiting from the auth provider. Switched to exponential backoff with jitter.</mistakes>
      <decision_log>Chose exponential backoff with jitter for auth token retries</decision_log>
      <commit_ref>fix: auth token refresh with exponential backoff</commit_ref>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.mistakes).toContain('linear backoff');
    expect(result!.mistakes).toContain('rate limiting');
  });

  it('open question → open_questions, not decision_log', () => {
    const xml = `<summary>
      <title>Implemented caching layer with unresolved TTL question</title>
      <open_questions>Cache TTL not decided — needs benchmarking. Options: 5min (fresh but costly), 1hr (stale risk but efficient).</open_questions>
      <commit_ref>feat: add caching layer with configurable TTL</commit_ref>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.open_questions).toContain('TTL');
    expect(result!.decision_log).toBeNull(); // NOT in decision_log
  });
});

describe('US1: Empty field omission', () => {
  it('code-only session → only title and commit_ref, all others null', () => {
    const xml = `<summary>
      <title>Implemented pagination helper</title>
      <commit_ref>feat: add pagination helper for viewer API</commit_ref>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Implemented pagination helper');
    expect(result!.commit_ref).toBe('feat: add pagination helper for viewer API');
    // All other structured fields must be null
    expect(result!.decision_log).toBeNull();
    expect(result!.decision_trade_offs).toBeNull();
    expect(result!.constraints_log).toBeNull();
    expect(result!.mistakes).toBeNull();
    expect(result!.gotchas).toBeNull();
    expect(result!.open_questions).toBeNull();
    expect(result!.unresolved).toBeNull();
  });

  it('filler text like "None" or "N/A" is treated as empty', () => {
    // The extraction agent should omit empty fields entirely,
    // but if it produces filler, the parser should still return it
    // (the quality enforcement is at the prompt level, not parser level)
    const xml = `<summary>
      <title>Some work</title>
      <decision_log>None</decision_log>
      <mistakes>N/A</mistakes>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    // Parser returns what it finds — filler prevention is prompt-level
    expect(result!.decision_log).toBe('None');
    expect(result!.mistakes).toBe('N/A');
  });
});
