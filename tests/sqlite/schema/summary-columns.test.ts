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
    ]);
  });

  it('SUMMARY_META_COLUMNS includes all meta fields', () => {
    expect(SUMMARY_META_COLUMNS).toEqual([
      'id', 'memory_session_id', 'project', 'prompt_number', 'discovery_tokens',
      'created_at', 'created_at_epoch',
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
    ]);
  });

  it('SUMMARY_INSERT_COLUMNS includes all non-auto-increment columns', () => {
    expect(SUMMARY_INSERT_COLUMNS).toEqual([
      'memory_session_id', 'project', 'request', 'investigated', 'learned', 'completed',
      'next_steps', 'files_read', 'files_edited', 'notes', 'prompt_number', 'discovery_tokens',
      'created_at', 'created_at_epoch',
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
          request TEXT,
          investigated TEXT,
          learned TEXT,
          completed TEXT,
          next_steps TEXT,
          files_read TEXT,
          files_edited TEXT,
          notes TEXT
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
