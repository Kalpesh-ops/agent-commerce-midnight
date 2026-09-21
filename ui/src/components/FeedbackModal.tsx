import React, { useState } from "react";
import {
  feedbackService,
  FeedbackCategory,
  UserFeedbackSubmission,
} from "../services/feedbackService";
import { telemetryService } from "../services/telemetryService";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLog?: (text: string, type?: "info" | "success" | "error") => void;
}

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "ONBOARDING", label: "🚀 Onboarding & Clarity" },
  { value: "WALLET", label: "👛 Lace Wallet Connection" },
  { value: "PRIVACY", label: "🛡️ Privacy & State Boundaries" },
  { value: "POLICY", label: "📜 Policy & Spending Bounds" },
  { value: "PROCUREMENT", label: "🏪 Marketplace & Procurement" },
  { value: "VERIFICATION", label: "⚖️ Evidence Verification" },
  { value: "USABILITY", label: "✨ General Usability / UI" },
  { value: "BUG", label: "🐛 Bug / Issue Report" },
  { value: "FEATURE_REQUEST", label: "💡 Feature Suggestion" },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  onLog,
}) => {
  const [category, setCategory] = useState<FeedbackCategory>("USABILITY");
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [testerHandle, setTesterHandle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submittedItem, setSubmittedItem] = useState<UserFeedbackSubmission | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const submission = feedbackService.submitFeedback({
        category,
        rating,
        title,
        description,
        testerHandle: testerHandle || undefined,
      });

      telemetryService.recordEvent("ONBOARDING_COMPLETED", "ONBOARDING", {
        feedbackCategory: category,
        rating,
      });

      setSubmittedItem(submission);
      if (onLog) {
        onLog(`Thank you! Feedback recorded: "${submission.title}" (${submission.feedbackId})`, "success");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCopyMarkdown = () => {
    if (!submittedItem) return;
    const md = feedbackService.exportAsMarkdown(submittedItem);
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReset = () => {
    setTitle("");
    setDescription("");
    setTesterHandle("");
    setRating(5);
    setCategory("USABILITY");
    setSubmittedItem(null);
    setError(null);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(5, 7, 15, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-glow)",
          borderRadius: "var(--radius-lg)",
          maxWidth: "580px",
          width: "100%",
          padding: "26px",
          position: "relative",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        <button
          onClick={handleReset}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>

        {submittedItem ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>🎉</div>
            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)" }}>
              Feedback Submitted Successfully!
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "8px", lineHeight: "1.5" }}>
              Your feedback has been recorded locally under <code>{submittedItem.feedbackId}</code> and added to the Level 5 tester log.
            </p>

            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--text-main)",
              }}
            >
              <div><strong>Category:</strong> {submittedItem.category}</div>
              <div><strong>Rating:</strong> {"★".repeat(submittedItem.rating)} ({submittedItem.rating}/5)</div>
              <div><strong>Title:</strong> {submittedItem.title}</div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "24px" }}>
              <button
                className="btn-secondary"
                onClick={handleCopyMarkdown}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                {copied ? "✓ Copied to Clipboard!" : "📋 Copy as GitHub Issue"}
              </button>
              <button
                className="btn-primary"
                onClick={handleReset}
                style={{ padding: "8px 20px", fontSize: "13px" }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "22px" }}>💬</span>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)" }}>
                Preprod Tester Feedback
              </h3>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "18px" }}>
              Your input directly shapes Pactra's production roadmap. Never enter private keys or wallet seeds.
            </p>

            {error && (
              <div
                style={{
                  background: "rgba(255, 51, 102, 0.12)",
                  border: "1px solid var(--crimson)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  color: "var(--crimson)",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Category */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Feedback Area
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(10, 14, 30, 0.8)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-main)",
                    fontSize: "13px",
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Experience Rating: {rating} / 5
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "24px",
                        cursor: "pointer",
                        color: star <= rating ? "var(--amber)" : "var(--text-dim)",
                        transition: "var(--transition)",
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Summary / Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lace connection was instant and smooth"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(10, 14, 30, 0.8)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-main)",
                    fontSize: "13px",
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Details, Confusion, or Suggestions
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us what worked, what was unclear, or what you'd like to see next..."
                  rows={4}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(10, 14, 30, 0.8)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-main)",
                    fontSize: "13px",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Tester Handle */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Tester Handle / Name (Optional)
                </label>
                <input
                  type="text"
                  value={testerHandle}
                  onChange={(e) => setTesterHandle(e.target.value)}
                  placeholder="@your_x_handle or GitHub username"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(10, 14, 30, 0.8)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-main)",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: "8px 20px", fontSize: "13px", fontWeight: 700 }}
              >
                Submit Feedback
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
