/**
 * Consumer integration tests
 *
 * Verifies that downstream types align with central schema constants.
 * These are compile-time + runtime contract checks, not full integration tests.
 */

import { describe, it, expect } from 'bun:test';
import { SUMMARY_CONTENT_COLUMNS, SUMMARY_FTS_COLUMNS } from '../../../src/services/sqlite/schema/summary-columns.js';
import type { SummaryInput } from '../../../src/services/sqlite/summaries/types.js';
import type { ParsedSummary } from '../../../src/sdk/parser.js';

describe('Consumer Type Alignment', () => {
  it('SummaryInput covers all content columns or documents exclusions', () => {
    // SummaryInput should include all FTS-indexed content fields
    // files_read and files_edited are excluded from SummaryInput (populated by import, not live capture)
    const summaryInputFields: (keyof SummaryInput)[] = ['request', 'investigated', 'learned', 'completed', 'next_steps', 'notes'];

    for (const field of SUMMARY_FTS_COLUMNS) {
      expect(summaryInputFields).toContain(field as keyof SummaryInput);
    }
  });

  it('ParsedSummary covers all FTS columns', () => {
    const parsedFields: (keyof ParsedSummary)[] = ['request', 'investigated', 'learned', 'completed', 'next_steps', 'notes'];

    for (const field of SUMMARY_FTS_COLUMNS) {
      expect(parsedFields).toContain(field as keyof ParsedSummary);
    }
  });

  it('SUMMARY_CONTENT_COLUMNS is superset of SUMMARY_FTS_COLUMNS', () => {
    for (const col of SUMMARY_FTS_COLUMNS) {
      expect([...SUMMARY_CONTENT_COLUMNS]).toContain(col);
    }
  });
});
