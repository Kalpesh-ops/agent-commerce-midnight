/**
 * Pactra — User Feedback Service
 *
 * Implements structured, non-custodial feedback capture and validation for Preprod testers.
 *
 * SAFETY INVARIANTS:
 * 1. Validates all inputs to prevent injection or malformed data.
 * 2. Rejects any feedback submission containing private keys, mnemonic seeds, or secrets.
 * 3. Formats feedback for export to GitHub Issues and docs/feedback-log.md.
 */

export type FeedbackCategory =
  | "ONBOARDING"
  | "WALLET"
  | "PRIVACY"
  | "POLICY"
  | "PROCUREMENT"
  | "VERIFICATION"
  | "USABILITY"
  | "BUG"
  | "FEATURE_REQUEST";

export interface UserFeedbackSubmission {
  readonly feedbackId: string;
  readonly category: FeedbackCategory;
  readonly rating: number; // 1 to 5
  readonly title: string;
  readonly description: string;
  readonly testerHandle?: string;
  readonly timestamp: number;
  status: "NEW" | "REVIEWED" | "RESOLVED";
}

export interface FeedbackSubmissionParams {
  category: FeedbackCategory;
  rating: number;
  title: string;
  description: string;
  testerHandle?: string;
}

export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(`Feedback Validation Error: ${message}`);
    this.name = "FeedbackValidationError";
  }
}

const FORBIDDEN_SECRET_PATTERNS = [
  /private\s*key/i,
  /seed\s*phrase/i,
  /mnemonic/i,
  /secret\s*recovery/i,
  /\b0x[0-9a-fA-F]{64}\b/,
];

export class FeedbackService {
  private feedbackList: UserFeedbackSubmission[] = [];
  private readonly storageKey = "pactra_user_feedback_v5";

  constructor() {
    this.loadFromStorage();
  }

  public validateAndSanitize(params: FeedbackSubmissionParams): void {
    if (!params.category) {
      throw new FeedbackValidationError("Feedback category is required.");
    }

    if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
      throw new FeedbackValidationError("Rating must be an integer between 1 and 5.");
    }

    const title = params.title?.trim() || "";
    if (title.length < 3 || title.length > 120) {
      throw new FeedbackValidationError("Title must be between 3 and 120 characters.");
    }

    const description = params.description?.trim() || "";
    if (description.length < 5 || description.length > 2000) {
      throw new FeedbackValidationError("Description must be between 5 and 2000 characters.");
    }

    const combinedText = `${title} ${description} ${params.testerHandle || ""}`;
    for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
      if (pattern.test(combinedText)) {
        throw new FeedbackValidationError(
          "Submission contains terms resembling private keys, seeds, or confidential secrets. Never share sensitive wallet information."
        );
      }
    }
  }

  public submitFeedback(params: FeedbackSubmissionParams): UserFeedbackSubmission {
    this.validateAndSanitize(params);

    const submission: UserFeedbackSubmission = {
      feedbackId: `fb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      category: params.category,
      rating: params.rating,
      title: params.title.trim(),
      description: params.description.trim(),
      testerHandle: params.testerHandle?.trim() || "Anonymous Tester",
      timestamp: Date.now(),
      status: "NEW",
    };

    this.feedbackList.unshift(submission);
    this.saveToStorage();
    return submission;
  }

  public getFeedbackList(): readonly UserFeedbackSubmission[] {
    return [...this.feedbackList];
  }

  public getCategoryCount(): Record<FeedbackCategory, number> {
    const counts: Record<FeedbackCategory, number> = {
      ONBOARDING: 0,
      WALLET: 0,
      PRIVACY: 0,
      POLICY: 0,
      PROCUREMENT: 0,
      VERIFICATION: 0,
      USABILITY: 0,
      BUG: 0,
      FEATURE_REQUEST: 0,
    };

    for (const fb of this.feedbackList) {
      counts[fb.category] = (counts[fb.category] || 0) + 1;
    }

    return counts;
  }

  public getAverageRating(): number {
    if (this.feedbackList.length === 0) return 0;
    const sum = this.feedbackList.reduce((acc, curr) => acc + curr.rating, 0);
    return Math.round((sum / this.feedbackList.length) * 10) / 10;
  }

  public exportAsMarkdown(submission: UserFeedbackSubmission): string {
    const dateStr = new Date(submission.timestamp).toISOString().split("T")[0];
    return [
      `### [${submission.category}] ${submission.title}`,
      `- **Tester:** ${submission.testerHandle}`,
      `- **Date:** ${dateStr}`,
      `- **Rating:** ${"★".repeat(submission.rating)}${"☆".repeat(5 - submission.rating)} (${submission.rating}/5)`,
      `- **Feedback:**`,
      `  > ${submission.description}`,
    ].join("\n");
  }

  public clear(): void {
    this.feedbackList = [];
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.feedbackList = JSON.parse(stored);
        }
      }
    } catch {
      this.feedbackList = [];
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.storageKey, JSON.stringify(this.feedbackList));
      }
    } catch {
      // ignore
    }
  }
}

export const feedbackService = new FeedbackService();
