/**
 * Schema initialization tests
 *
 * Verifies that MigrationRunner produces correct session_summaries tables,
 * and that FTS5 helpers produce valid FTS tables with working triggers.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { ClaudeMemDatabase } from '../../../src/services/sqlite/Database.js';
import {
  SUMMARY_ALL_COLUMNS,
  SUMMARY_FTS_COLUMNS,
  summaryFTSCreateSQL,
} from '../../../src/services/sqlite/schema/summary-columns.js';

describe('Schema Initialization', () => {
  let db: Database;

  afterEach(() => {
    if (db) db.close();
  });

  it('MigrationRunner produces session_summaries with all expected columns', () => {
    db = new ClaudeMemDatabase(':memory:').db;
    const columns = db.prepare('PRAGMA table_info(session_summaries)').all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    for (const col of SUMMARY_ALL_COLUMNS) {
      expect(columnNames).toContain(col);
    }
  });

  it('summaryFTSCreateSQL() creates valid FTS5 table with triggers', () => {
    db = new ClaudeMemDatabase(':memory:').db;

    // Create FTS table using the central helper
    db.run(summaryFTSCreateSQL());

    // Create sync triggers using FTS columns
    const ftsCols = SUMMARY_FTS_COLUMNS.join(', ');
    const newRefs = SUMMARY_FTS_COLUMNS.map(c => `new.${c}`).join(', ');
    const oldRefs = SUMMARY_FTS_COLUMNS.map(c => `old.${c}`).join(', ');

    db.run(`
      CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
        INSERT INTO session_summaries_fts(rowid, ${ftsCols}) VALUES (new.id, ${newRefs});
      END;
      CREATE TRIGGER IF NOT EXISTS session_summaries_ad AFTER DELETE ON session_summaries BEGIN
        INSERT INTO session_summaries_fts(session_summaries_fts, rowid, ${ftsCols}) VALUES('delete', old.id, ${oldRefs});
      END;
    `);

    // Verify FTS table exists
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='session_summaries_fts'"
    ).all() as { name: string }[];
    expect(tables.length).toBe(1);

    // Test INSERT trigger fires
    db.run(`
      INSERT INTO sdk_sessions (content_session_id, memory_session_id, project, user_prompt, started_at, started_at_epoch, status)
      VALUES ('cs-1', 'ms-1', '/test', 'test', '2026-01-01T00:00:00Z', 1735689600000, 'active')
    `);
    db.run(`
      INSERT INTO session_summaries (memory_session_id, project, request, investigated, learned, completed, next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
      VALUES ('ms-1', '/test', 'test request', 'test investigated', 'test learned', 'test completed', 'test next', 'test notes', 1, 0, '2026-01-01T00:00:00Z', 1735689600000)
    `);

    const ftsResults = db.prepare(
      "SELECT * FROM session_summaries_fts WHERE session_summaries_fts MATCH 'test request'"
    ).all();
    expect(ftsResults.length).toBe(1);

    // Test DELETE trigger fires
    db.run("DELETE FROM session_summaries WHERE request = 'test request'");
    const afterDelete = db.prepare(
      "SELECT * FROM session_summaries_fts WHERE session_summaries_fts MATCH 'test request'"
    ).all();
    expect(afterDelete.length).toBe(0);
  });
});
