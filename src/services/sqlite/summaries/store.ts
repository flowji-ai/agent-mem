/**
 * Store session summaries in the database
 */
import type { Database } from 'bun:sqlite';
import { logger } from '../../../utils/logger.js';
import type { SummaryInput, StoreSummaryResult } from './types.js';
import { SUMMARY_INSERT_COLUMNS, summaryInsertPlaceholders } from '../schema/index.js';

/**
 * Store a session summary (from SDK parsing)
 * Assumes session already exists - will fail with FK error if not
 *
 * @param db - Database instance
 * @param memorySessionId - SDK memory session ID
 * @param project - Project name
 * @param summary - Summary content from SDK parsing
 * @param promptNumber - Optional prompt number
 * @param discoveryTokens - Token count for discovery (default 0)
 * @param overrideTimestampEpoch - Optional timestamp override for backlog processing
 */
export function storeSummary(
  db: Database,
  memorySessionId: string,
  project: string,
  summary: SummaryInput,
  promptNumber?: number,
  discoveryTokens: number = 0,
  overrideTimestampEpoch?: number
): StoreSummaryResult {
  // Use override timestamp if provided (for processing backlog messages with original timestamps)
  const timestampEpoch = overrideTimestampEpoch ?? Date.now();
  const timestampIso = new Date(timestampEpoch).toISOString();

  const stmt = db.prepare(`
    INSERT INTO session_summaries (${SUMMARY_INSERT_COLUMNS.join(', ')})
    VALUES (${summaryInsertPlaceholders()})
  `);

  // Parameter order must match SUMMARY_INSERT_COLUMNS exactly
  const result = stmt.run(
    memorySessionId,
    project,
    summary.request,
    summary.investigated,
    summary.learned,
    summary.completed,
    summary.next_steps,
    null, // files_read — populated by import, not live capture
    null, // files_edited — populated by import, not live capture
    summary.notes,
    // Phase 1 structured fields
    summary.title || null,
    summary.decision_log || null,
    summary.decision_trade_offs || null,
    summary.constraints_log || null,
    summary.mistakes || null,
    summary.gotchas || null,
    summary.commit_ref || null,
    summary.open_questions || null,
    summary.unresolved || null,
    promptNumber || null,
    discoveryTokens,
    timestampIso,
    timestampEpoch,
    // Phase 1 scaffolding
    5, // importance — default
    null, // hidden_fields
    'auto', // source — default
  );

  return {
    id: Number(result.lastInsertRowid),
    createdAtEpoch: timestampEpoch
  };
}
