import { describe, it, expect, beforeEach } from "vitest";
import {
  FeedbackService,
  FeedbackValidationError,
} from "../services/feedbackService";

describe("FeedbackService — Tester Feedback Validation & Integrity", () => {
  let feedbackService: FeedbackService;

  beforeEach(() => {
    feedbackService = new FeedbackService();
    feedbackService.clear();
  });

  it("submits valid feedback and assigns unique feedbackId", () => {
    const submission = feedbackService.submitFeedback({
      category: "ONBOARDING",
      rating: 5,
      title: "Clean 30-second onboarding experience",
      description: "The 4-pillar overview made the bounded authority concept immediately clear.",
      testerHandle: "@midnight_dev",
    });

    expect(submission.feedbackId).toMatch(/^fb_/);
    expect(submission.category).toBe("ONBOARDING");
    expect(submission.rating).toBe(5);
    expect(submission.testerHandle).toBe("@midnight_dev");
    expect(submission.status).toBe("NEW");
    expect(feedbackService.getFeedbackList().length).toBe(1);
  });

  it("computes average rating and category breakdown correctly", () => {
    feedbackService.submitFeedback({
      category: "WALLET",
      rating: 4,
      title: "Lace connection smooth",
      description: "Handshake worked on the first attempt.",
    });

    feedbackService.submitFeedback({
      category: "PRIVACY",
      rating: 5,
      title: "Commitment simulator impressive",
      description: "Interactive dual-state view demonstrates real privacy boundary.",
    });

    feedbackService.submitFeedback({
      category: "BUG",
      rating: 3,
      title: "Indexer delay notice",
      description: "Preprod indexer took 20 seconds to confirm newly deployed contract.",
    });

    expect(feedbackService.getAverageRating()).toBe(4);
    const categoryCounts = feedbackService.getCategoryCount();
    expect(categoryCounts.WALLET).toBe(1);
    expect(categoryCounts.PRIVACY).toBe(1);
    expect(categoryCounts.BUG).toBe(1);
    expect(categoryCounts.ONBOARDING).toBe(0);
  });

  it("rejects invalid rating numbers (< 1 or > 5 or non-integers)", () => {
    expect(() => {
      feedbackService.submitFeedback({
        category: "USABILITY",
        rating: 0,
        title: "Bad rating",
        description: "Zero stars is invalid.",
      });
    }).toThrow(FeedbackValidationError);

    expect(() => {
      feedbackService.submitFeedback({
        category: "USABILITY",
        rating: 6,
        title: "Bad rating",
        description: "Six stars is invalid.",
      });
    }).toThrow(FeedbackValidationError);
  });

  it("rejects empty or overly short titles and descriptions", () => {
    expect(() => {
      feedbackService.submitFeedback({
        category: "BUG",
        rating: 3,
        title: "No",
        description: "Too short title.",
      });
    }).toThrow(FeedbackValidationError);

    expect(() => {
      feedbackService.submitFeedback({
        category: "BUG",
        rating: 3,
        title: "Valid Title Here",
        description: "Bad",
      });
    }).toThrow(FeedbackValidationError);
  });

  it("CRITICAL: rejects feedback containing sensitive wallet secrets or private keys", () => {
    expect(() => {
      feedbackService.submitFeedback({
        category: "BUG",
        rating: 1,
        title: "Key error",
        description: "My private key is 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      });
    }).toThrow(FeedbackValidationError);

    expect(() => {
      feedbackService.submitFeedback({
        category: "WALLET",
        rating: 2,
        title: "Seed phrase issue",
        description: "My seed phrase was not recognized by the extension dialog.",
      });
    }).toThrow(FeedbackValidationError);
  });

  it("exports feedback as structured markdown report", () => {
    const sub = feedbackService.submitFeedback({
      category: "FEATURE_REQUEST",
      rating: 5,
      title: "Add remote SSE MCP server",
      description: "Would love to connect Claude Desktop to a remote endpoint in Level 5.",
      testerHandle: "@agent_builder",
    });

    const markdown = feedbackService.exportAsMarkdown(sub);
    expect(markdown).toContain("### [FEATURE_REQUEST] Add remote SSE MCP server");
    expect(markdown).toContain("- **Tester:** @agent_builder");
    expect(markdown).toContain("★★★★★ (5/5)");
  });
});
