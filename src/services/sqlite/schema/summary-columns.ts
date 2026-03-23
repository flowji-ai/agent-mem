/**
 * Central schema constants for session_summaries table
 *
 * Single source of truth for column names, SELECT lists, INSERT templates,
 * and FTS5 configuration. All query builders should reference these constants
 * instead of hardcoding column names.
 */

/** Content columns — the actual summary content fields */
export const SUMMARY_CONTENT_COLUMNS = [
  'request', 'investigated', 'learned', 'completed', 'next_steps',
  'files_read', 'files_edited', 'notes',
] as const;

/** Meta columns — identifiers, timestamps, and metadata */
export const SUMMARY_META_COLUMNS = [
  'id', 'memory_session_id', 'project', 'prompt_number', 'discovery_tokens',
  'created_at', 'created_at_epoch',
] as const;

/** All columns (meta + content), no duplicates */
export const SUMMARY_ALL_COLUMNS = [
  ...SUMMARY_META_COLUMNS,
  ...SUMMARY_CONTENT_COLUMNS,
] as const;

/** FTS5-indexed columns (text fields that benefit from full-text search) */
export const SUMMARY_FTS_COLUMNS = [
  'request', 'investigated', 'learned', 'completed', 'next_steps', 'notes',
] as const;

/** INSERT columns — all columns except auto-increment id */
export const SUMMARY_INSERT_COLUMNS = [
  'memory_session_id', 'project', 'request', 'investigated', 'learned', 'completed',
  'next_steps', 'files_read', 'files_edited', 'notes', 'prompt_number', 'discovery_tokens',
  'created_at', 'created_at_epoch',
] as const;

// ── Named column subsets for common SELECT projections ──

/** getSummaryForSession: content + prompt_number + timestamps (no id/memory_session_id/project) */
export const SUMMARY_SESSION_SELECT = [
  'request', 'investigated', 'learned', 'completed', 'next_steps',
  'files_read', 'files_edited', 'notes', 'prompt_number', 'created_at', 'created_at_epoch',
] as const;

/** getRecentSummaries: content + prompt_number + created_at (no epoch) */
export const SUMMARY_RECENT_SELECT = [
  'request', 'investigated', 'learned', 'completed', 'next_steps',
  'files_read', 'files_edited', 'notes', 'prompt_number', 'created_at',
] as const;

/** getRecentSummariesWithSessionInfo: minimal fields for context display */
export const SUMMARY_SESSION_INFO_SELECT = [
  'memory_session_id', 'request', 'learned', 'completed', 'next_steps',
  'prompt_number', 'created_at',
] as const;

/** getAllRecentSummaries: full summary for web UI */
export const SUMMARY_FULL_SELECT = [
  'id', 'request', 'investigated', 'learned', 'completed', 'next_steps',
  'files_read', 'files_edited', 'notes', 'project', 'prompt_number',
  'created_at', 'created_at_epoch',
] as const;

/** querySummaries: context compiler single-project */
export const SUMMARY_CONTEXT_SELECT = [
  'id', 'memory_session_id', 'request', 'investigated', 'learned', 'completed',
  'next_steps', 'created_at', 'created_at_epoch',
] as const;

/** querySummariesMulti: context compiler multi-project (adds project) */
export const SUMMARY_CONTEXT_MULTI_SELECT = [
  'id', 'memory_session_id', 'request', 'investigated', 'learned', 'completed',
  'next_steps', 'created_at', 'created_at_epoch', 'project',
] as const;

/**
 * Generate a comma-separated SELECT column list.
 * Defaults to all columns if no subset provided.
 */
export function summarySelectCols(columns?: readonly string[]): string {
  const cols = columns ?? SUMMARY_ALL_COLUMNS;
  return cols.join(', ');
}

/**
 * Generate INSERT placeholder string matching SUMMARY_INSERT_COLUMNS.
 * Returns: "?, ?, ?, ..." with one placeholder per insert column.
 */
export function summaryInsertPlaceholders(): string {
  return SUMMARY_INSERT_COLUMNS.map(() => '?').join(', ');
}

/**
 * Generate FTS5 CREATE TABLE SQL for session_summaries_fts.
 * Uses content-sync mode linked to the session_summaries table.
 */
export function summaryFTSCreateSQL(): string {
  return `CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
  ${SUMMARY_FTS_COLUMNS.join(', ')},
  content='session_summaries',
  content_rowid='id'
)`;
}

/**
 * Generate FTS5 sync triggers for session_summaries → session_summaries_fts.
 * Handles INSERT, DELETE, and UPDATE operations to keep FTS in sync.
 */
export function summaryFTSTriggersSQL(): string {
  const ftsCols = SUMMARY_FTS_COLUMNS.join(', ');
  const newRefs = SUMMARY_FTS_COLUMNS.map(c => `new.${c}`).join(', ');
  const oldRefs = SUMMARY_FTS_COLUMNS.map(c => `old.${c}`).join(', ');

  return `
    CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(rowid, ${ftsCols})
      VALUES (new.id, ${newRefs});
    END;

    CREATE TRIGGER IF NOT EXISTS session_summaries_ad AFTER DELETE ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(session_summaries_fts, rowid, ${ftsCols})
      VALUES('delete', old.id, ${oldRefs});
    END;

    CREATE TRIGGER IF NOT EXISTS session_summaries_au AFTER UPDATE ON session_summaries BEGIN
      INSERT INTO session_summaries_fts(session_summaries_fts, rowid, ${ftsCols})
      VALUES('delete', old.id, ${oldRefs});
      INSERT INTO session_summaries_fts(rowid, ${ftsCols})
      VALUES (new.id, ${newRefs});
    END;
  `;
}
