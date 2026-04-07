/**
 * SummaryRenderer - Renders the summary section at the end of context
 *
 * Handles rendering of the most recent session summary fields.
 * Phase 1: renders both old fields (backward compat) and new structured fields.
 */

import type { ContextConfig, Observation, SessionSummary } from '../types.js';
import { colors } from '../types.js';
import * as Markdown from '../formatters/MarkdownFormatter.js';
import * as Color from '../formatters/ColorFormatter.js';

/**
 * Check if summary should be displayed
 */
export function shouldShowSummary(
  config: ContextConfig,
  mostRecentSummary: SessionSummary | undefined,
  mostRecentObservation: Observation | undefined
): boolean {
  if (!config.showLastSummary || !mostRecentSummary) {
    return false;
  }

  const hasContent = !!(
    // Old fields
    mostRecentSummary.investigated ||
    mostRecentSummary.learned ||
    mostRecentSummary.completed ||
    mostRecentSummary.next_steps ||
    // New structured fields
    mostRecentSummary.decision_log ||
    mostRecentSummary.constraints_log ||
    mostRecentSummary.mistakes ||
    mostRecentSummary.gotchas ||
    mostRecentSummary.open_questions ||
    mostRecentSummary.unresolved
  );

  if (!hasContent) {
    return false;
  }

  // Only show if summary is more recent than observations
  if (mostRecentObservation && mostRecentSummary.created_at_epoch <= mostRecentObservation.created_at_epoch) {
    return false;
  }

  return true;
}

/**
 * Render summary fields — new structured fields first (higher signal),
 * then old fields for backward compat with pre-Phase 1 snapshots.
 * Null/empty fields are omitted entirely.
 */
export function renderSummaryFields(
  summary: SessionSummary,
  useColors: boolean
): string[] {
  const output: string[] = [];

  const render = (label: string, value: string | null | undefined, color?: string) => {
    if (!value) return;
    if (useColors && color) {
      output.push(...Color.renderColorSummaryField(label, value, color));
    } else {
      output.push(...Markdown.renderMarkdownSummaryField(label, value));
    }
  };

  // New structured fields (Phase 1) — render first, higher signal
  render('Decisions', summary.decision_log, colors.green);
  render('Trade-offs', summary.decision_trade_offs, colors.yellow);
  render('Constraints', summary.constraints_log, colors.magenta);
  render('Mistakes', summary.mistakes, colors.red);
  render('Gotchas', summary.gotchas, colors.red);
  render('Commit', summary.commit_ref, colors.blue);
  render('Open Questions', summary.open_questions, colors.yellow);
  render('Unresolved', summary.unresolved, colors.magenta);

  // Old fields (backward compat for pre-Phase 1 snapshots)
  render('Investigated', summary.investigated, colors.blue);
  render('Learned', summary.learned, colors.yellow);
  render('Completed', summary.completed, colors.green);
  render('Next Steps', summary.next_steps, colors.magenta);

  return output;
}
