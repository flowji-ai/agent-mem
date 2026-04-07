/**
 * Central schema constants tests for session_summaries
 *
 * Verifies that column constants, SQL helpers, and FTS creation
 * produce correct and consistent results against an in-memory DB.
 */

import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  SUMMARY_CONTENT_COLUMNS,
  SUMMARY_META_COLUMNS,
  SUMMARY_ALL_COLUMNS,
  SUMMARY_FTS_COLUMNS,
  SUMMARY_INSERT_COLUMNS,
  summarySelectCols,
  summaryInsertPlaceholders,
  summaryFTSCreateSQL,
} from '../../../src/services/sqlite/schema/summary-columns.js';

describe('Summary Column Constants', () => {
  it('SUMMARY_CONTENT_COLUMNS includes all content fields', () => {
    expect(SUMMARY_CONTENT_COLUMNS).toEqual([
      'request', 'investigated', 'learned', 'completed', 'next_steps',
      'files_read', 'files_edited', 'notes',
      'title', 'decision_log', 'decision_trade_offs', 'constraints_log',
      'mistakes', 'gotchas', 'commit_ref', 'open_questions', 'unresolved',
    ]);
  });

  it('SUMMARY_META_COLUMNS includes all meta fields', () => {
    expect(SUMMARY_META_COLUMNS).toEqual([
      'id', 'memory_session_id', 'project', 'prompt_number', 'discovery_tokens',
      'created_at', 'created_at_epoch',
      'importance', 'hidden_fields', 'source',
    ]);
  });

  it('SUMMARY_ALL_COLUMNS is meta + content with no duplicates', () => {
    const combined = [...SUMMARY_META_COLUMNS, ...SUMMARY_CONTENT_COLUMNS];
    expect(SUMMARY_ALL_COLUMNS).toEqual(combined);
    // No duplicates
    expect(new Set(SUMMARY_ALL_COLUMNS).size).toBe(SUMMARY_ALL_COLUMNS.length);
  });

  it('SUMMARY_FTS_COLUMNS includes text-searchable fields', () => {
    expect(SUMMARY_FTS_COLUMNS).toEqual([
      'request', 'investigated', 'learned', 'completed', 'next_steps', 'notes',
      'title', 'decision_log', 'decision_trade_offs', 'constraints_log',
      'mistakes', 'gotchas', 'commit_ref', 'open_questions', 'unresolved',
    ]);
  });

  it('SUMMARY_INSERT_COLUMNS includes all non-auto-increment columns', () => {
    expect(SUMMARY_INSERT_COLUMNS).toEqual([
      'memory_session_id', 'project', 'request', 'investigated', 'learned', 'completed',
      'next_steps', 'files_read', 'files_edited', 'notes',
      'title', 'decision_log', 'decision_trade_offs', 'constraints_log',
      'mistakes', 'gotchas', 'commit_ref', 'open_questions', 'unresolved',
      'prompt_number', 'discovery_tokens', 'created_at', 'created_at_epoch',
      'importance', 'hidden_fields', 'source',
    ]);
    // INSERT should not include 'id' (auto-increment)
    expect(SUMMARY_INSERT_COLUMNS).not.toContain('id');
  });
});

describe('Summary SQL Helpers', () => {
  it('summarySelectCols() with no args returns all columns', () => {
    const sql = summarySelectCols();
    expect(sql).toBe(SUMMARY_ALL_COLUMNS.join(', '));
  });

  it('summarySelectCols() with subset returns only those columns', () => {
    const subset = ['request', 'learned', 'completed'] as const;
    expect(summarySelectCols(subset)).toBe('request, learned, completed');
  });

  it('summaryInsertPlaceholders() returns correct count', () => {
    const placeholders = summaryInsertPlaceholders();
    const questionMarks = placeholders.split(',').map(s => s.trim());
    expect(questionMarks.length).toBe(SUMMARY_INSERT_COLUMNS.length);
    expect(questionMarks.every(q => q === '?')).toBe(true);
  });

  it('summaryFTSCreateSQL() produces valid SQL', () => {
    const db = new Database(':memory:');
    try {
      // Create the content table first (FTS5 content table reference)
      db.run(`
        CREATE TABLE session_summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${SUMMARY_FTS_COLUMNS.map(c => `${c} TEXT`).join(', ')}
        )
      `);
      // Execute FTS creation — should not throw
      db.run(summaryFTSCreateSQL());
      // Verify table was created
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='session_summaries_fts'"
      ).all() as { name: string }[];
      expect(tables.length).toBe(1);
    } finally {
      db.close();
    }
  });
});

describe('SELECT Column Regression', () => {
  // Each test captures the exact column string from the original hardcoded query
  // and verifies summarySelectCols() with the same subset produces an identical string.

  it('getSummaryForSession columns match', () => {
    const original = 'request, investigated, learned, completed, next_steps, files_read, files_edited, notes, prompt_number, created_at, created_at_epoch';
    const cols = ['request', 'investigated', 'learned', 'completed', 'next_steps', 'files_read', 'files_edited', 'notes', 'prompt_number', 'created_at', 'created_at_epoch'] as const;
    expect(summarySelectCols(cols)).toBe(original);
  });

  it('getRecentSummaries columns match', () => {
    const original = 'request, investigated, learned, completed, next_steps, files_read, files_edited, notes, prompt_number, created_at';
    const cols = ['request', 'investigated', 'learned', 'completed', 'next_steps', 'files_read', 'files_edited', 'notes', 'prompt_number', 'created_at'] as const;
    expect(summarySelectCols(cols)).toBe(original);
  });

  it('getRecentSummariesWithSessionInfo columns match', () => {
    const original = 'memory_session_id, request, learned, completed, next_steps, prompt_number, created_at';
    const cols = ['memory_session_id', 'request', 'learned', 'completed', 'next_steps', 'prompt_number', 'created_at'] as const;
    expect(summarySelectCols(cols)).toBe(original);
  });

  it('getAllRecentSummaries columns match', () => {
    const original = 'id, request, investigated, learned, completed, next_steps, files_read, files_edited, notes, project, prompt_number, created_at, created_at_epoch';
    const cols = ['id', 'request', 'investigated', 'learned', 'completed', 'next_steps', 'files_read', 'files_edited', 'notes', 'project', 'prompt_number', 'created_at', 'created_at_epoch'] as const;
    expect(summarySelectCols(cols)).toBe(original);
  });

  it('querySummaries columns match', () => {
    const original = 'id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch';
    const cols = ['id', 'memory_session_id', 'request', 'investigated', 'learned', 'completed', 'next_steps', 'created_at', 'created_at_epoch'] as const;
    expect(summarySelectCols(cols)).toBe(original);
  });

  it('querySummariesMulti columns match', () => {
    const original = 'id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch, project';
    const cols = ['id', 'memory_session_id', 'request', 'investigated', 'learned', 'completed', 'next_steps', 'created_at', 'created_at_epoch', 'project'] as const;
    expect(summarySelectCols(cols)).toBe(original);
  });
});

describe('INSERT Roundtrip', () => {
  it('INSERT using SUMMARY_INSERT_COLUMNS stores and retrieves all fields correctly', () => {
    const db = new Database(':memory:');
    try {
      db.run(`
        CREATE TABLE session_summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          request TEXT,
          investigated TEXT,
          learned TEXT,
          completed TEXT,
          next_steps TEXT,
          files_read TEXT,
          files_edited TEXT,
          notes TEXT,
          title TEXT,
          decision_log TEXT,
          decision_trade_offs TEXT,
          constraints_log TEXT,
          mistakes TEXT,
          gotchas TEXT,
          commit_ref TEXT,
          open_questions TEXT,
          unresolved TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          importance INTEGER DEFAULT 5,
          hidden_fields TEXT,
          source TEXT DEFAULT 'auto'
        )
      `);

      const testValues: Record<string, string | number | null> = {
        memory_session_id: 'test-session-123',
        project: '/test/project',
        request: 'test_request',
        investigated: 'test_investigated',
        learned: 'test_learned',
        completed: 'test_completed',
        next_steps: 'test_next_steps',
        files_read: '["file1.ts"]',
        files_edited: '["file2.ts"]',
        notes: 'test_notes',
        title: 'test_title',
        decision_log: 'test_decision_log',
        decision_trade_offs: 'test_trade_offs',
        constraints_log: 'test_constraints',
        mistakes: 'test_mistakes',
        gotchas: 'test_gotchas',
        commit_ref: 'test_commit',
        open_questions: 'test_questions',
        unresolved: 'test_unresolved',
        prompt_number: 5,
        discovery_tokens: 1234,
        created_at: '2026-01-01T00:00:00.000Z',
        created_at_epoch: 1767225600000,
        importance: 7,
        hidden_fields: '["gotchas"]',
        source: 'manual',
      };

      // Build INSERT using central constants
      const cols = SUMMARY_INSERT_COLUMNS.join(', ');
      const placeholders = summaryInsertPlaceholders();
      const params = SUMMARY_INSERT_COLUMNS.map(col => testValues[col as keyof typeof testValues]);

      db.prepare(`INSERT INTO session_summaries (${cols}) VALUES (${placeholders})`).run(...params);

      // Read back and verify every field
      const row = db.prepare('SELECT * FROM session_summaries WHERE id = 1').get() as Record<string, unknown>;
      expect(row).toBeDefined();

      for (const col of SUMMARY_INSERT_COLUMNS) {
        expect(row[col]).toBe(testValues[col as keyof typeof testValues]);
      }
      expect(row.id).toBe(1);
    } finally {
      db.close();
    }
  });
});

describe('Schema Roundtrip', () => {
  it('PRAGMA table_info columns match SUMMARY_ALL_COLUMNS', () => {
    const db = new Database(':memory:');
    try {
      db.run(`
        CREATE TABLE session_summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          prompt_number INTEGER,
          discovery_tokens INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          importance INTEGER DEFAULT 5,
          hidden_fields TEXT,
          source TEXT DEFAULT 'auto',
          request TEXT,
          investigated TEXT,
          learned TEXT,
          completed TEXT,
          next_steps TEXT,
          files_read TEXT,
          files_edited TEXT,
          notes TEXT,
          title TEXT,
          decision_log TEXT,
          decision_trade_offs TEXT,
          constraints_log TEXT,
          mistakes TEXT,
          gotchas TEXT,
          commit_ref TEXT,
          open_questions TEXT,
          unresolved TEXT
        )
      `);
      const columns = db.prepare('PRAGMA table_info(session_summaries)').all() as { name: string }[];
      const dbColumnNames = columns.map(c => c.name);

      // Every constant column should exist in the DB schema
      for (const col of SUMMARY_ALL_COLUMNS) {
        expect(dbColumnNames).toContain(col);
      }
      // DB should not have extra columns beyond our constants
      for (const col of dbColumnNames) {
        expect([...SUMMARY_ALL_COLUMNS]).toContain(col);
      }
    } finally {
      db.close();
    }
  });
});
