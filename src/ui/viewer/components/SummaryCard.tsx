import React from "react";
import { Summary } from "../types";
import { formatDate } from "../utils/formatters";

interface SummaryCardProps {
  summary: Summary;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const date = formatDate(summary.created_at_epoch);
  const isManual = summary.source === 'manual';
  const displayTitle = summary.title || summary.request;

  // New structured fields (Phase 1) — render first, higher signal
  const structuredSections = [
    { key: "decision_log", label: "Decisions", content: summary.decision_log, icon: "/icon-thick-completed.svg" },
    { key: "decision_trade_offs", label: "Trade-offs", content: summary.decision_trade_offs, icon: "/icon-thick-learned.svg" },
    { key: "constraints_log", label: "Constraints", content: summary.constraints_log, icon: "/icon-thick-next-steps.svg" },
    { key: "mistakes", label: "Mistakes", content: summary.mistakes, icon: "/icon-thick-investigated.svg" },
    { key: "gotchas", label: "Gotchas", content: summary.gotchas, icon: "/icon-thick-investigated.svg" },
    { key: "commit_ref", label: "Commit", content: summary.commit_ref, icon: "/icon-thick-completed.svg" },
    { key: "open_questions", label: "Open Questions", content: summary.open_questions, icon: "/icon-thick-next-steps.svg" },
    { key: "unresolved", label: "Unresolved", content: summary.unresolved, icon: "/icon-thick-next-steps.svg" },
  ].filter((section) => section.content);

  // Old fields (backward compat for pre-Phase 1 snapshots)
  const legacySections = [
    { key: "investigated", label: "Investigated", content: summary.investigated, icon: "/icon-thick-investigated.svg" },
    { key: "learned", label: "Learned", content: summary.learned, icon: "/icon-thick-learned.svg" },
    { key: "completed", label: "Completed", content: summary.completed, icon: "/icon-thick-completed.svg" },
    { key: "next_steps", label: "Next Steps", content: summary.next_steps, icon: "/icon-thick-next-steps.svg" },
  ].filter((section) => section.content);

  const sections = structuredSections.length > 0 ? structuredSections : legacySections;

  return (
    <article className={`card summary-card${isManual ? ' summary-card--manual' : ''}`}>
      <header className="summary-card-header">
        <div className="summary-badge-row">
          <span className={`card-type summary-badge${isManual ? ' summary-badge--manual' : ''}`}>
            {isManual ? '📌 Manual Capture' : 'Snapshot'}
          </span>
          <span className="summary-project-badge">{summary.project}</span>
          {summary.importance && summary.importance >= 9 && (
            <span className="summary-importance-badge">High Priority</span>
          )}
        </div>
        {displayTitle && (
          <h2 className="summary-title">{displayTitle}</h2>
        )}
      </header>

      <div className="summary-sections">
        {sections.map((section, index) => (
          <section
            key={section.key}
            className="summary-section"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="summary-section-header">
              <img
                src={section.icon}
                alt={section.label}
                className={`summary-section-icon summary-section-icon--${section.key}`}
              />
              <h3 className="summary-section-label">{section.label}</h3>
            </div>
            <div className="summary-section-content">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      <footer className="summary-card-footer">
        <span className="summary-meta-id">Session #{summary.id}</span>
        <span className="summary-meta-divider">•</span>
        <time className="summary-meta-date" dateTime={new Date(summary.created_at_epoch).toISOString()}>
          {date}
        </time>
      </footer>
    </article>
  );
}
