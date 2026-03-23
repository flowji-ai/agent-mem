/**
 * Central schema constants for observations table
 *
 * Single source of truth for column names. Query builders should reference
 * these constants instead of hardcoding column names.
 */

/** Content columns — the actual observation content fields */
export const OBSERVATION_CONTENT_COLUMNS = [
  'type', 'title', 'subtitle', 'facts', 'narrative', 'concepts',
  'files_read', 'files_modified', 'text',
] as const;

/** Meta columns — identifiers, timestamps, and metadata */
export const OBSERVATION_META_COLUMNS = [
  'id', 'memory_session_id', 'project', 'prompt_number', 'discovery_tokens',
  'content_hash', 'created_at', 'created_at_epoch',
] as const;

/** All columns (meta + content) */
export const OBSERVATION_ALL_COLUMNS = [
  ...OBSERVATION_META_COLUMNS,
  ...OBSERVATION_CONTENT_COLUMNS,
] as const;

/** FTS5-indexed columns */
export const OBSERVATION_FTS_COLUMNS = [
  'title', 'subtitle', 'narrative', 'facts', 'concepts',
] as const;

/** INSERT columns for transactions.ts (with content_hash, without text) */
export const OBSERVATION_INSERT_COLUMNS = [
  'memory_session_id', 'project', 'type', 'title', 'subtitle', 'facts', 'narrative', 'concepts',
  'files_read', 'files_modified', 'prompt_number', 'discovery_tokens', 'content_hash',
  'created_at', 'created_at_epoch',
] as const;

/** INSERT columns for bulk import (with text, without content_hash) */
export const OBSERVATION_IMPORT_COLUMNS = [
  'memory_session_id', 'project', 'text', 'type', 'title', 'subtitle',
  'facts', 'narrative', 'concepts', 'files_read', 'files_modified',
  'prompt_number', 'discovery_tokens', 'created_at', 'created_at_epoch',
] as const;
