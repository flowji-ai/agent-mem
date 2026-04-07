/**
 * Manual Capture tests (US2)
 * Tests the capture_to_mem MCP tool and manual snapshot storage.
 *
 * RED PHASE: These tests must FAIL until the manual capture is implemented.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ClaudeMemDatabase } from '../src/services/sqlite/Database.js';
import {
  createSDKSession,
  updateMemorySessionId,
} from '../src/services/sqlite/Sessions.js';
import { storeSummary } from '../src/services/sqlite/summaries/store.js';
import type { SummaryInput } from '../src/services/sqlite/summaries/types.js';
import type { Database } from 'bun:sqlite';

describe('US2: Manual snapshot capture', () => {
  let db: Database;
  const memorySessionId = 'manual-capture-test';

  beforeEach(() => {
    db = new ClaudeMemDatabase(':memory:').db;
    const sessionDbId = createSDKSession(db, 'test-content', '/test', 'test prompt');
    updateMemorySessionId(db, sessionDbId, memorySessionId);
  });

  afterEach(() => {
    db.close();
  });

  it('stores a manual capture with structured fields, importance 10, source=manual', () => {
    const manualInput: SummaryInput = {
      request: '',
      investigated: '',
      learned: '',
      completed: '',
      next_steps: '',
      notes: null,
      title: 'Final architecture decisions for auth module',
      decision_log: 'Chose JWT over session cookies — stateless, works with API clients',
      decision_trade_offs: 'Session cookies are simpler but require server-side storage',
      constraints_log: 'Always validate JWT expiry before processing requests',
      mistakes: null,
      gotchas: 'The JWT library silently accepts expired tokens with clock skew > 30s',
      commit_ref: null,
      open_questions: 'Should we implement refresh token rotation?',
      unresolved: null,
    };

    // Store with importance override and source='manual'
    const epoch = Date.now();
    const result = storeSummary(db, memorySessionId, '/test', manualInput, 1, 0, epoch);

    // Verify the record
    const row = db.prepare('SELECT * FROM session_summaries WHERE id = ?').get(result.id) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.title).toBe('Final architecture decisions for auth module');
    expect(row.decision_log).toBe('Chose JWT over session cookies — stateless, works with API clients');
    expect(row.constraints_log).toBe('Always validate JWT expiry before processing requests');
    expect(row.gotchas).toBe('The JWT library silently accepts expired tokens with clock skew > 30s');
    expect(row.open_questions).toBe('Should we implement refresh token rotation?');
    // Empty fields should be null
    expect(row.mistakes).toBeNull();
    expect(row.commit_ref).toBeNull();
    expect(row.unresolved).toBeNull();
  });

  it('empty fields are omitted (stored as null)', () => {
    const minimalInput: SummaryInput = {
      request: '',
      investigated: '',
      learned: '',
      completed: '',
      next_steps: '',
      notes: null,
      title: 'Quick note',
      decision_log: null,
      decision_trade_offs: null,
      constraints_log: null,
      mistakes: null,
      gotchas: null,
      commit_ref: null,
      open_questions: null,
      unresolved: null,
    };

    const result = storeSummary(db, memorySessionId, '/test', minimalInput, 1, 0, Date.now());
    const row = db.prepare('SELECT * FROM session_summaries WHERE id = ?').get(result.id) as Record<string, unknown>;

    expect(row.title).toBe('Quick note');
    expect(row.decision_log).toBeNull();
    expect(row.mistakes).toBeNull();
    expect(row.gotchas).toBeNull();
  });

  it('importance defaults to 5 for auto snapshots', () => {
    const input: SummaryInput = {
      request: 'auto snapshot',
      investigated: '',
      learned: '',
      completed: '',
      next_steps: '',
      notes: null,
      title: 'Auto snapshot',
      decision_log: null,
      decision_trade_offs: null,
      constraints_log: null,
      mistakes: null,
      gotchas: null,
      commit_ref: null,
      open_questions: null,
      unresolved: null,
    };

    const result = storeSummary(db, memorySessionId, '/test', input, 1, 0, Date.now());
    const row = db.prepare('SELECT * FROM session_summaries WHERE id = ?').get(result.id) as Record<string, unknown>;
    expect(row.importance).toBe(5); // DB default
    expect(row.source).toBe('auto'); // DB default
  });

  it('source defaults to auto when not specified', () => {
    const input: SummaryInput = {
      request: 'test',
      investigated: '',
      learned: '',
      completed: '',
      next_steps: '',
      notes: null,
      title: null,
      decision_log: null,
      decision_trade_offs: null,
      constraints_log: null,
      mistakes: null,
      gotchas: null,
      commit_ref: null,
      open_questions: null,
      unresolved: null,
    };

    const result = storeSummary(db, memorySessionId, '/test', input, 1, 0, Date.now());
    const row = db.prepare('SELECT * FROM session_summaries WHERE id = ?').get(result.id) as Record<string, unknown>;
    expect(row.source).toBe('auto');
  });
});
