import React, { useRef, useState } from "react";
import { feedbackService, FeedbackCategory, UserFeedbackSubmission } from "../services/feedbackService";
import { telemetryService } from "../services/telemetryService";
import { Dialog, FieldError, LogFn } from "./ui";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLog?: LogFn;
}

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "USABILITY", label: "General usability" },
  { value: "ONBOARDING", label: "Getting started" },
  { value: "WALLET", label: "Lace wallet connection" },
  { value: "PRIVACY", label: "Privacy and what is public" },
  { value: "POLICY", label: "Policy and spending limits" },
  { value: "PROCUREMENT", label: "Services and purchasing" },
  { value: "VERIFICATION", label: "Evidence and verification" },
  { value: "BUG", label: "Something is broken" },
  { value: "FEATURE_REQUEST", label: "Feature request" },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onLog }) => {
  const [category, setCategory] = useState<FeedbackCategory>("USABILITY");
  const [rating, setRating] = useState<number>(4);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [testerHandle, setTesterHandle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submittedItem, setSubmittedItem] = useState<UserFeedbackSubmission | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [triedSubmit, setTriedSubmit] = useState<boolean>(false);
  const submitting = useRef(false);

  if (!isOpen) return null;

  // Mirrors feedbackService limits so problems show next to the field instead of after submit.
  const titleLen = title.trim().length;
  const descLen = description.trim().length;
  const titleError = titleLen < 3 ? "Write at least 3 characters." : null;
  const descError = descLen < 5 ? "Write at least 5 characters." : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter plus a click, or a double click, must not save the same entry twice.
    if (submitting.current || submittedItem) return;
    setTriedSubmit(true);
    setError(null);
    if (titleError || descError) return;
    submitting.current = true;

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
        onLog(`Feedback saved: "${submission.title}" (${submission.feedbackId})`, "success");
      }
    } catch (err: any) {
      setError(err.message);
      // Only a failed save unlocks the form; a successful one stays locked until the dialog is reset.
      submitting.current = false;
    }
  };

  const handleCopyMarkdown = () => {
    if (!submittedItem) return;
    navigator.clipboard.writeText(feedbackService.exportAsMarkdown(submittedItem));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReset = () => {
    setTitle("");
    setDescription("");
    setTesterHandle("");
    setRating(4);
    setCategory("USABILITY");
    setSubmittedItem(null);
    setError(null);
    setTriedSubmit(false);
    submitting.current = false;
    onClose();
  };

  if (submittedItem) {
    return (
      <Dialog
        labelId="fb-done"
        onClose={handleReset}
        title={<h2 className="section">Thanks, that is saved</h2>}
        footer={
          <>
            <button className="btn" onClick={handleCopyMarkdown}>
              {copied ? "Copied" : "Copy as GitHub issue"}
            </button>
            <button className="btn btn--primary" onClick={handleReset}>
              Done
            </button>
          </>
        }
      >
        <p className="muted" style={{ marginBottom: 16 }}>
          It is stored in this browser as <span className="hash">{submittedItem.feedbackId}</span>. To send it to the
          maintainers, copy it as a GitHub issue and paste it in the repository.
        </p>
        <dl className="kv">
          <dt>Area</dt>
          <dd>{CATEGORIES.find((c) => c.value === submittedItem.category)?.label}</dd>
          <dt>Rating</dt>
          <dd>{submittedItem.rating} of 5</dd>
          <dt>Title</dt>
          <dd>{submittedItem.title}</dd>
        </dl>
      </Dialog>
    );
  }

  return (
    <Dialog labelId="fb-title" onClose={handleReset} title={<h2 className="section">Send feedback</h2>}>
      <form onSubmit={handleSubmit} noValidate>
        <p className="small muted" style={{ marginBottom: 20 }}>
          What worked, what confused you, what broke. Never paste a seed phrase or private key.
        </p>

        {error && (
          <div className="notice notice--bad" style={{ marginBottom: 16 }} role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="fb-cat">
            Area
          </label>
          <select id="fb-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)}>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="label" id="fb-rating">
            How was it overall?
          </span>
          <div className="scale" role="group" aria-labelledby="fb-rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-pressed={rating === n} onClick={() => setRating(n)}>
                {n}
              </button>
            ))}
          </div>
          <p className="hint">1 is poor, 5 is excellent.</p>
        </div>

        <div className="field">
          <label className="label" htmlFor="fb-t">
            Summary
          </label>
          <input
            id="fb-t"
            type="text"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lace connected on the first try"
            required
            maxLength={120}
            aria-invalid={triedSubmit && Boolean(titleError)}
            aria-describedby="fb-t-error"
          />
          <FieldError id="fb-t-error">{triedSubmit ? titleError : null}</FieldError>
        </div>

        <div className="field">
          <label className="label" htmlFor="fb-d">
            Details
          </label>
          <textarea
            id="fb-d"
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you tried, what you expected, what happened."
            rows={4}
            required
            maxLength={2000}
            aria-invalid={triedSubmit && Boolean(descError)}
            aria-describedby="fb-d-error fb-d-count"
          />
          <FieldError id="fb-d-error">{triedSubmit ? descError : null}</FieldError>
          <p id="fb-d-count" className="hint">
            {descLen} / 2000
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="fb-h">
            Your handle <span className="faint">(optional)</span>
          </label>
          <input
            id="fb-h"
            type="text"
            className="input"
            value={testerHandle}
            onChange={(e) => setTesterHandle(e.target.value)}
            placeholder="@handle on X or GitHub"
          />
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 24 }}>
          <button type="button" className="btn" onClick={handleReset}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save feedback
          </button>
        </div>
      </form>
    </Dialog>
  );
};
