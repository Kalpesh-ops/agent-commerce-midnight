import React, { useState } from "react";
import {
  feedbackService,
  UserFeedbackSubmission,
  FeedbackCategory,
} from "../services/feedbackService";

interface FeedbackDashboardProps {
  onLog?: (text: string, type?: "info" | "success" | "error") => void;
}

export const FeedbackDashboard: React.FC<FeedbackDashboardProps> = ({ onLog }) => {
  const [feedbackList, setFeedbackList] = useState<readonly UserFeedbackSubmission[]>(
    feedbackService.getFeedbackList()
  );
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  const refresh = () => {
    setFeedbackList(feedbackService.getFeedbackList());
  };

  const filtered =
    filterCategory === "ALL"
      ? feedbackList
      : feedbackList.filter((fb) => fb.category === filterCategory);

  const categoryCounts = feedbackService.getCategoryCount();
  const avgRating = feedbackService.getAverageRating();

  const handleCopyAll = () => {
    if (feedbackList.length === 0) return;
    const text = feedbackList
      .map((fb) => feedbackService.exportAsMarkdown(fb))
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
    if (onLog) onLog(`Copied ${feedbackList.length} tester submissions to clipboard!`, "info");
  };

  const handleStatusChange = (feedbackId: string, newStatus: "NEW" | "REVIEWED" | "RESOLVED") => {
    const item = feedbackList.find((f) => f.feedbackId === feedbackId);
    if (item) {
      item.status = newStatus;
      refresh();
      if (onLog) onLog(`Updated ${feedbackId} status to ${newStatus}.`, "info");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255, 170, 0, 0.08) 0%, rgba(112, 69, 255, 0.1) 100%)",
          border: "1px solid var(--border-glow)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "24px" }}>🛠️</span>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)" }}>
                Internal Tester Feedback Dashboard
              </h2>
              <span
                style={{
                  background: "rgba(255, 170, 0, 0.15)",
                  color: "var(--amber)",
                  border: "1px solid rgba(255, 170, 0, 0.3)",
                  borderRadius: "var(--radius-full)",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "2px 8px",
                }}
              >
                DEVELOPER VIEW
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "800px", lineHeight: "1.6" }}>
              Developer console for reviewing community bug reports, onboarding friction logs, and feature requests. All submissions are client-sanitized with zero private keys or secrets stored.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="btn-secondary"
              onClick={handleCopyAll}
              disabled={feedbackList.length === 0}
              style={{ padding: "8px 16px", fontSize: "12px" }}
            >
              {copiedAll ? "✓ Copied All to Clipboard!" : "📋 Export All to Markdown"}
            </button>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          <div style={{ background: "rgba(0,0,0,0.35)", padding: "14px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>TOTAL ENTRIES</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-main)", marginTop: "4px" }}>
              {feedbackList.length}
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.35)", padding: "14px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>AVERAGE RATING</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--amber)", marginTop: "4px" }}>
              {avgRating > 0 ? `${avgRating} ★` : "N/A"}
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.35)", padding: "14px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>BUG REPORTS</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--crimson)", marginTop: "4px" }}>
              {categoryCounts.BUG}
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.35)", padding: "14px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>FEATURE REQUESTS</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--cyan)", marginTop: "4px" }}>
              {categoryCounts.FEATURE_REQUEST}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {[
          { key: "ALL", label: `All (${feedbackList.length})` },
          { key: "BUG", label: `Bugs (${categoryCounts.BUG})` },
          { key: "FEATURE_REQUEST", label: `Features (${categoryCounts.FEATURE_REQUEST})` },
          { key: "ONBOARDING", label: `Onboarding (${categoryCounts.ONBOARDING})` },
          { key: "WALLET", label: `Wallet (${categoryCounts.WALLET})` },
          { key: "PRIVACY", label: `Privacy (${categoryCounts.PRIVACY})` },
          { key: "USABILITY", label: `Usability (${categoryCounts.USABILITY})` },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`btn-secondary ${filterCategory === tab.key ? "active" : ""}`}
            onClick={() => setFilterCategory(tab.key)}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              background: filterCategory === tab.key ? "rgba(112, 69, 255, 0.25)" : "rgba(255,255,255,0.03)",
              borderColor: filterCategory === tab.key ? "var(--primary)" : "var(--border-subtle)",
              color: filterCategory === tab.key ? "var(--cyan)" : "var(--text-muted)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback List Table / Cards */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ fontSize: "32px", display: "block", marginBottom: "12px" }}>📬</span>
          <h4 style={{ fontSize: "16px", color: "var(--text-main)", marginBottom: "6px" }}>
            No Feedback in Selected Category Yet
          </h4>
          <p style={{ fontSize: "13px" }}>
            Click "💬 Feedback" in the top header to submit a test review or bug report.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map((fb) => (
            <div
              key={fb.feedbackId}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "18px 20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span
                      style={{
                        background:
                          fb.category === "BUG"
                            ? "rgba(255, 51, 102, 0.15)"
                            : fb.category === "FEATURE_REQUEST"
                            ? "rgba(0, 240, 255, 0.15)"
                            : "rgba(112, 69, 255, 0.15)",
                        color:
                          fb.category === "BUG"
                            ? "var(--crimson)"
                            : fb.category === "FEATURE_REQUEST"
                            ? "var(--cyan)"
                            : "var(--primary-glow)",
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {fb.category}
                    </span>
                    <span style={{ color: "var(--amber)", fontSize: "13px" }}>
                      {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      {fb.feedbackId}
                    </span>
                  </div>

                  <h4 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                    {fb.title}
                  </h4>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <select
                    value={fb.status}
                    onChange={(e) => handleStatusChange(fb.feedbackId, e.target.value as any)}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "4px",
                      color:
                        fb.status === "RESOLVED"
                          ? "var(--emerald)"
                          : fb.status === "REVIEWED"
                          ? "var(--cyan)"
                          : "var(--amber)",
                      fontWeight: 700,
                    }}
                  >
                    <option value="NEW">Status: NEW</option>
                    <option value="REVIEWED">Status: REVIEWED</option>
                    <option value="RESOLVED">Status: RESOLVED</option>
                  </select>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "8px", lineHeight: "1.5" }}>
                {fb.description}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "12px",
                  paddingTop: "10px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                  fontSize: "11px",
                  color: "var(--text-dim)",
                }}
              >
                <span>Submitted by: <strong style={{ color: "var(--text-muted)" }}>{fb.testerHandle}</strong></span>
                <span>{new Date(fb.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
