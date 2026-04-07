/**
 * Migration test for Phase 1 snapshot fields
 * Tests migration version 24: new structured snapshot columns + FTS5 update
 *
 * RED PHASE: These tests must FAIL until the migration is implemented.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ClaudeMemDatabase } from '../../src/services/sqlite/Database.js';
import {
  createSDKSession,
  updateMemorySessionId,
} from '../../src/services/sqlite/Sessions.js';
import type { Database } from 'bun:sqlite';

interface TableColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

describe('Migration 24: Phase 1 Snapshot Fields', () => {
  let db: Database;
  const memorySessionId = 'test-memory-migration';

  beforeEach(() => {
    db = new ClaudeMemDatabase(':memory:').db;
    // Create prerequisite session for FK constraints
    const sessionDbId = createSDKSession(db, 'test-content', '/test', 'test prompt');
    updateMemorySessionId(db, sessionDbId, memorySessionId);
  });

  afterEach(() => {
    db.close();
  });

  describe('New columns exist', () => {
    const NEW_COLUMNS = [
      { name: 'title', type: 'TEXT' },
      { name: 'decision_log', type: 'TEXT' },
      { name: 'decision_trade_offs', type: 'TEXT' },
      { name: 'constraints_log', type: 'TEXT' },
      { name: 'mistakes', type: 'TEXT' },
      { name: 'gotchas', type: 'TEXT' },
      { name: 'commit_ref', type: 'TEXT' },
      { name: 'open_questions', type: 'TEXT' },
      { name: 'unresolved', type: 'TEXT' },
      { name: 'importance', type: 'INTEGER' },
      { name: 'hidden_fields', type: 'TEXT' },
      { name: 'source', type: 'TEXT' },
    ];

    for (const col of NEW_COLUMNS) {
      it(`has column ${col.name} (${col.type})`, () => {
        const columns = db.query('PRAGMA table_info(session_summaries)').all() as TableColumnInfo[];
        const column = columns.find(c => c.name === col.name);
        expect(column).toBeDefined();
        expect(column!.type).toBe(col.type);
      });
    }

    it('importance column defaults to 5', () => {
      const columns = db.query('PRAGMA table_info(session_summaries)').all() as TableColumnInfo[];
      const importance = columns.find(c => c.name === 'importance');
      expect(importance).toBeDefined();
      expect(importance!.dflt_value).toBe('5');
    });

    it('source column defaults to auto', () => {
      const columns = db.query('PRAGMA table_info(session_summaries)').all() as TableColumnInfo[];
      const source = columns.find(c => c.name === 'source');
      expect(source).toBeDefined();
      expect(source!.dflt_value).toBe("'auto'");
    });
  });

  describe('Old records survive migration', () => {
    it('existing records have null for new fields', () => {
      db.prepare(
        `INSERT INTO session_summaries (memory_session_id, project, request, investigated, learned, completed, next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(memorySessionId, '/test', 'old request', 'old investigated', 'old learned', 'old completed', 'old next', 'old notes', 1, 100, new Date().toISOString(), Date.now());

      const row = db.prepare('SELECT * FROM session_summaries WHERE request = ?').get('old request') as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.request).toBe('old request');
      expect(row.title).toBeNull();
      expect(row.decision_log).toBeNull();
      expect(row.mistakes).toBeNull();
      expect(row.importance).toBe(5); // default
      expect(row.source).toBe('auto'); // default
    });
  });

  describe('FTS5 indexes new columns', () => {
    it('FTS5 table exists with new columns', () => {
      const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='session_summaries_fts'").all() as { name: string }[];
      expect(tables.length).toBe(1);
    });

    it('FTS5 search finds content in decision_log', () => {
      db.prepare(
        `INSERT INTO session_summaries (memory_session_id, project, request, decision_log, mistakes, prompt_number, discovery_tokens, created_at, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(memorySessionId, '/test', 'test request', 'Chose React over Vue for component library', 'Tried Angular first but it was too heavy', 1, 100, new Date().toISOString(), Date.now());

      const results = db.query(
        "SELECT * FROM session_summaries_fts WHERE session_summaries_fts MATCH 'React'"
      ).all();
      expect(results.length).toBe(1);
    });

    it('FTS5 search finds content in mistakes', () => {
      db.prepare(
        `INSERT INTO session_summaries (memory_session_id, project, request, mistakes, prompt_number, discovery_tokens, created_at, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(memorySessionId, '/test', 'test request', 'Accidentally deleted the production database', 1, 100, new Date().toISOString(), Date.now());

      const results = db.query(
        "SELECT * FROM session_summaries_fts WHERE session_summaries_fts MATCH 'production'"
      ).all();
      expect(results.length).toBe(1);
    });

    it('INSERT trigger syncs new record to FTS', () => {
      db.prepare(
        `INSERT INTO session_summaries (memory_session_id, project, request, constraints_log, prompt_number, discovery_tokens, created_at, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(memorySessionId, '/test', 'trigger test', 'Always use TypeScript strict mode', 1, 100, new Date().toISOString(), Date.now());

      const ftsResults = db.query(
        "SELECT * FROM session_summaries_fts WHERE session_summaries_fts MATCH 'TypeScript'"
      ).all();
      expect(ftsResults.length).toBe(1);
    });

    it('DELETE trigger removes record from FTS', () => {
      db.prepare(
        `INSERT INTO session_summaries (memory_session_id, project, request, gotchas, prompt_number, discovery_tokens, created_at, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(memorySessionId, '/test', 'delete test', 'Hidden dependency on libcurl version', 1, 100, new Date().toISOString(), Date.now());

      let results = db.query("SELECT * FROM session_summaries_fts WHERE session_summaries_fts MATCH 'libcurl'").all();
      expect(results.length).toBe(1);

      db.prepare("DELETE FROM session_summaries WHERE request = 'delete test'").run();

      results = db.query("SELECT * FROM session_summaries_fts WHERE session_summaries_fts MATCH 'libcurl'").all();
      expect(results.length).toBe(0);
    });
  });

  describe('Schema version tracking', () => {
    it('records migration version 24', () => {
      const version = db.prepare('SELECT version FROM schema_versions WHERE version = ?').get(24) as { version: number } | undefined;
      expect(version).toBeDefined();
      expect(version!.version).toBe(24);
    });
  });
});
