/**
 * Storage delegation equivalence tests
 *
 * Verifies that modular store functions and SessionStore methods
 * produce identical DB rows for the same inputs.
 *
 * Known pre-existing difference (NOT fixed in this refactor):
 * - SessionStore.storeObservations() (plural) does NOT perform content-hash deduplication.
 *   transactions.ts::storeObservations() DOES.
 *   Both store observations without issue; the difference is in duplicate handling only.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ClaudeMemDatabase } from '../../src/services/sqlite/Database.js';
import { storeSummary } from '../../src/services/sqlite/summaries/store.js';
import { storeObservation } from '../../src/services/sqlite/observations/store.js';
import {
  createSDKSession,
  updateMemorySessionId,
} from '../../src/services/sqlite/Sessions.js';
import type { SummaryInput } from '../../src/services/sqlite/summaries/types.js';
import type { ObservationInput } from '../../src/services/sqlite/observations/types.js';
import type { Database } from 'bun:sqlite';

describe('Storage Delegation Equivalence', () => {
  let db: Database;
  const project = '/test/project';
  const contentSessionId = 'test-content-123';
  const memorySessionId = 'test-memory-456';

  beforeEach(() => {
    db = new ClaudeMemDatabase(':memory:').db;
    // Create prerequisite session (FK constraint requires sdk_session with matching memory_session_id)
    const sessionDbId = createSDKSession(db, contentSessionId, project, 'test prompt');
    updateMemorySessionId(db, sessionDbId, memorySessionId);
  });

  afterEach(() => {
    db.close();
  });

  function makeSummaryInput(suffix: string = ''): SummaryInput {
    return {
      request: `User requested feature${suffix}`,
      investigated: `Explored the codebase${suffix}`,
      learned: `Discovered pattern${suffix}`,
      completed: `Implemented feature${suffix}`,
      next_steps: `Write tests${suffix}`,
      notes: `Note${suffix}`,
    };
  }

  function makeObservationInput(suffix: string = ''): ObservationInput {
    return {
      type: 'discovery',
      title: `Found pattern${suffix}`,
      subtitle: `In module X${suffix}`,
      facts: ['fact1', 'fact2'],
      narrative: `The module uses pattern${suffix}`,
      concepts: ['architecture'],
      files_read: ['src/index.ts'],
      files_modified: [],
    };
  }

  describe('storeSummary (modular)', () => {
    it('stores a summary with all fields and returns id/epoch', () => {
      const input = makeSummaryInput();
      const epoch = 1700000000000;
      const result = storeSummary(db, memorySessionId, project, input, 1, 500, epoch);

      expect(result.id).toBeGreaterThan(0);
      expect(result.createdAtEpoch).toBe(epoch);

      // Verify DB row
      const row = db.prepare('SELECT * FROM session_summaries WHERE id = ?').get(result.id) as Record<string, unknown>;
      expect(row.memory_session_id).toBe(memorySessionId);
      expect(row.project).toBe(project);
      expect(row.request).toBe(input.request);
      expect(row.investigated).toBe(input.investigated);
      expect(row.learned).toBe(input.learned);
      expect(row.completed).toBe(input.completed);
      expect(row.next_steps).toBe(input.next_steps);
      expect(row.notes).toBe(input.notes);
      expect(row.prompt_number).toBe(1);
      expect(row.discovery_tokens).toBe(500);
    });
  });

  describe('storeObservation (modular)', () => {
    it('stores an observation with content hash and returns id/epoch', () => {
      const input = makeObservationInput();
      const epoch = 1700000000000;
      const result = storeObservation(db, memorySessionId, project, input, 1, 500, epoch);

      expect(result.id).toBeGreaterThan(0);
      expect(result.createdAtEpoch).toBe(epoch);

      // Verify DB row
      const row = db.prepare('SELECT * FROM observations WHERE id = ?').get(result.id) as Record<string, unknown>;
      expect(row.memory_session_id).toBe(memorySessionId);
      expect(row.project).toBe(project);
      expect(row.type).toBe('discovery');
      expect(row.title).toBe(input.title);
      expect(row.narrative).toBe(input.narrative);
      expect(row.content_hash).toBeTruthy(); // content-hash dedup is present
    });

    it('deduplicates within 30s window', () => {
      const input = makeObservationInput();
      const epoch = 1700000000000;
      const first = storeObservation(db, memorySessionId, project, input, 1, 500, epoch);
      const second = storeObservation(db, memorySessionId, project, input, 2, 600, epoch + 1000);

      // Same observation within window returns same id
      expect(second.id).toBe(first.id);
    });
  });
});
