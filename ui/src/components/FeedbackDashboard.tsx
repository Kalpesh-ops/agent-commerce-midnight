import React, { useState } from "react";
import { feedbackService, UserFeedbackSubmission } from "../services/feedbackService";
import { LogFn, Tag } from "./ui";

interface FeedbackDashboardProps {
  onLog?: LogFn;
  onOpenFeedback?: () => void;
}

export const FeedbackDashboard: React.FC<FeedbackDashboardProps> = ({ onLog, onOpenFeedback }) => {
  const [feedbackList, setFeedbackList] = useState<readonly UserFeedbackSubmission[]>(feedbackService.getFeedbackList());
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  const refresh = () => {
    setFeedbackList(feedbackService.getFeedbackList());
  };

  const filtered = filterCategory === "ALL" ? feedbackList : feedbackList.filter((fb) => fb.category === filterCategory);

  const categoryCounts = feedbackService.getCategoryCount();
  const avgRating = feedbackService.getAverageRating();

  const handleCopyAll = () => {
    if (feedbackList.length === 0) return;
    const text = feedbackList.map((fb) => feedbackService.exportAsMarkdown(fb)).join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
    if (onLog) onLog(`Copied ${feedbackList.length} feedback entries as Markdown.`, "info");
  };

  const handleStatusChange = (feedbackId: string, newStatus: "NEW" | "REVIEWED" | "RESOLVED") => {
    const item = feedbackList.find((f) => f.feedbackId === feedbackId);
    if (item) {
      item.status = newStatus;
      refresh();
      if (onLog) onLog(`${feedbackId} marked ${newStatus.toLowerCase()}.`, "info");
    }
  };

  const tabs = [
    { key: "ALL", label: "All", n: feedbackList.length },
    { key: "BUG", label: "Bugs", n: categoryCounts.BUG },
    { key: "FEATURE_REQUEST", label: "Requests", n: categoryCounts.FEATURE_REQUEST },
    { key: "ONBOARDING", label: "Onboarding", n: categoryCounts.ONBOARDING },
    { key: "WALLET", label: "Wallet", n: categoryCounts.WALLET },
    { key: "PRIVACY", label: "Privacy", n: categoryCounts.PRIVACY },
    { key: "USABILITY", label: "Usability", n: categoryCounts.USABILITY },
  ];

  return (
    <section>
      <div className="strip" style={{ marginBottom: 20 }}>
        <div>
          <div className="strip-label">Entries</div>
          <div className="figure">{feedbackList.length}</div>
        </div>
        <div>
          <div className="strip-label">Average rating</div>
          <div className="figure">
            {avgRating > 0 ? avgRating : "n/a"}
            {avgRating > 0 && <span className="figure-unit">of 5</span>}
          </div>
        </div>
        <div>
          <div className="strip-label">Bugs</div>
          <div className="figure">{categoryCounts.BUG}</div>
        </div>
        <div>
          <div className="strip-label">Requests</div>
          <div className="figure">{categoryCounts.FEATURE_REQUEST}</div>
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 4 }}>
        <p className="small muted">Stored only in this browser. Secrets are stripped before saving.</p>
        <div className="row">
          {onOpenFeedback && (
            <button className="btn btn--sm btn--primary" onClick={onOpenFeedback}>
              Write feedback
            </button>
          )}
          <button className="btn btn--sm" onClick={handleCopyAll} disabled={feedbackList.length === 0}>
            {copiedAll ? "Copied" : "Copy all as Markdown"}
          </button>
        </div>
      </div>

      <div className="filters" role="toolbar" aria-label="Filter feedback">
        {tabs.map((t) => (
          <button key={t.key} aria-pressed={filterCategory === t.key} onClick={() => setFilterCategory(t.key)}>
            {t.label} <span className="faint">{t.n}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="sheet sheet-body">
          <h3 className="sub">Nothing here yet</h3>
          <p className="small muted" style={{ marginTop: 4 }}>
            Feedback you write appears in this list. Use "Write feedback" above or the link in the footer.
          </p>
        </div>
      ) : (
        <ol style={{ listStyle: "none" }} className="sheet">
          {filtered.map((fb, i) => (
            <li key={fb.feedbackId} className="sheet-body" style={i > 0 ? { borderTop: "1px solid var(--rule)" } : undefined}>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    <Tag tone={fb.category === "BUG" ? "bad" : "plain"}>{fb.category.replace(/_/g, " ")}</Tag>
                    <span className="small">{fb.rating} of 5</span>
                    <span className="hash faint">{fb.feedbackId}</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 600 }}>{fb.title}</h4>
                </div>
                <label>
                  <span className="sr-only">Status</span>
                  <select
                    className="select"
                    style={{ width: "auto", minHeight: 32, fontSize: 13 }}
                    value={fb.status}
                    onChange={(e) => handleStatusChange(fb.feedbackId, e.target.value as any)}
                  >
                    <option value="NEW">New</option>
                    <option value="REVIEWED">Reviewed</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </label>
              </div>
              <p className="small muted" style={{ marginTop: 8, maxWidth: "72ch" }}>
                {fb.description}
              </p>
              <div className="tiny faint" style={{ marginTop: 10 }}>
                {fb.testerHandle} · {new Date(fb.timestamp).toLocaleString()}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
