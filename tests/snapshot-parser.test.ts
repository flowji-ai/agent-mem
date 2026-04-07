/**
 * Parser test for Phase 1 structured snapshot fields
 * Tests parseSummary() with new XML fields
 *
 * RED PHASE: These tests must FAIL until the parser is updated.
 */

import { describe, it, expect } from 'bun:test';
import { parseSummary } from '../src/sdk/parser.js';

describe('parseSummary — new structured fields', () => {
  it('extracts all new fields from well-formed XML', () => {
    const xml = `<summary>
      <title>Chose React for component library</title>
      <decision_log>Chose React over Vue — better ecosystem for our team size</decision_log>
      <decision_trade_offs>Vue has simpler API but React has more community support</decision_trade_offs>
      <constraints_log>Always use TypeScript strict mode in this codebase</constraints_log>
      <mistakes>Tried Angular first — too heavy for a plugin UI</mistakes>
      <gotchas>The esbuild config silently drops CSS imports without the plugin</gotchas>
      <commit_ref>feat: add component library scaffold (abc1234)</commit_ref>
      <open_questions>Should we vendor the icon set or use a CDN?</open_questions>
      <unresolved>Auth token refresh logic not yet implemented</unresolved>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Chose React for component library');
    expect(result!.decision_log).toBe('Chose React over Vue — better ecosystem for our team size');
    expect(result!.decision_trade_offs).toBe('Vue has simpler API but React has more community support');
    expect(result!.constraints_log).toBe('Always use TypeScript strict mode in this codebase');
    expect(result!.mistakes).toBe('Tried Angular first — too heavy for a plugin UI');
    expect(result!.gotchas).toBe('The esbuild config silently drops CSS imports without the plugin');
    expect(result!.commit_ref).toBe('feat: add component library scaffold (abc1234)');
    expect(result!.open_questions).toBe('Should we vendor the icon set or use a CDN?');
    expect(result!.unresolved).toBe('Auth token refresh logic not yet implemented');
  });

  it('returns null (not filler) for missing fields', () => {
    const xml = `<summary>
      <title>Quick code fix</title>
      <commit_ref>fix: typo in README</commit_ref>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Quick code fix');
    expect(result!.commit_ref).toBe('fix: typo in README');
    // All other fields should be null, not "None" or "N/A"
    expect(result!.decision_log).toBeNull();
    expect(result!.decision_trade_offs).toBeNull();
    expect(result!.constraints_log).toBeNull();
    expect(result!.mistakes).toBeNull();
    expect(result!.gotchas).toBeNull();
    expect(result!.open_questions).toBeNull();
    expect(result!.unresolved).toBeNull();
  });

  it('handles old-format XML gracefully (backward compat)', () => {
    const xml = `<summary>
      <request>User asked to fix the auth bug</request>
      <investigated>Checked the token refresh logic</investigated>
      <learned>The refresh token was expiring silently</learned>
      <completed>Fixed token refresh with retry</completed>
      <next_steps>Add integration test for token flow</next_steps>
      <notes>Consider adding monitoring for token failures</notes>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    // Old fields should still work
    expect(result!.request).toBe('User asked to fix the auth bug');
    expect(result!.investigated).toBe('Checked the token refresh logic');
    expect(result!.learned).toBe('The refresh token was expiring silently');
    expect(result!.completed).toBe('Fixed token refresh with retry');
    expect(result!.next_steps).toBe('Add integration test for token flow');
    expect(result!.notes).toBe('Consider adding monitoring for token failures');
    // New fields should be null
    expect(result!.title).toBeNull();
    expect(result!.decision_log).toBeNull();
  });

  it('handles mixed old and new fields', () => {
    const xml = `<summary>
      <title>Auth bug fix with decision</title>
      <request>Fix the auth bug</request>
      <decision_log>Chose retry with exponential backoff over simple retry</decision_log>
      <completed>Implemented retry logic</completed>
      <mistakes>First attempt used linear backoff which caused rate limiting</mistakes>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Auth bug fix with decision');
    expect(result!.request).toBe('Fix the auth bug');
    expect(result!.decision_log).toBe('Chose retry with exponential backoff over simple retry');
    expect(result!.completed).toBe('Implemented retry logic');
    expect(result!.mistakes).toBe('First attempt used linear backoff which caused rate limiting');
  });

  it('returns null for empty/whitespace-only new fields', () => {
    const xml = `<summary>
      <title>Some work</title>
      <decision_log>   </decision_log>
      <mistakes></mistakes>
      <gotchas>
      </gotchas>
    </summary>`;

    const result = parseSummary(xml);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Some work');
    expect(result!.decision_log).toBeNull();
    expect(result!.mistakes).toBeNull();
    expect(result!.gotchas).toBeNull();
  });

  it('still returns null for skip_summary', () => {
    const xml = '<skip_summary reason="no meaningful content" />';
    const result = parseSummary(xml);
    expect(result).toBeNull();
  });
});
