import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import {
  FRAMER_COMPLETION_DETAILS_TYPE,
  finishFramerWorkSchema,
  type FinishFramerWorkInput,
  type FramerCompletionDetails,
} from "./contracts.js";
import {
  derivedReviewStatus,
  incompleteReviewReason,
  type FramerRunState,
} from "./framer-run-state.js";

export function createFramerCompletionExtension(state: FramerRunState): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    let completedThisRun = false;
    pi.on("agent_start", () => {
      completedThisRun = false;
    });
    pi.on("agent_end", () => {
      const incomplete = incompleteReviewReason(state);
      if (!completedThisRun && incomplete) {
        pi.sendMessage({
          customType: "lottus_runtime_status",
          content: `Framer work incomplete: ${incomplete}.`,
          display: true,
          details: {
            runOutcome: "failed",
            code: "FRAMER_WORK_INCOMPLETE",
            message: `Framer work incomplete: ${incomplete}.`,
            action: incomplete,
          },
        }, { triggerTurn: false });
      }
    });
    pi.registerTool({
      name: "finish_framer_work",
      label: "Finish Framer Work",
      description: "Finish the Prompt Run with a structured result. Review status is derived from canvas and code-file evidence.",
      promptSnippet: "Finish with a structured user-facing summary after every required domain check",
      promptGuidelines: [
        "Call finish_framer_work as the only tool in its batch when the request is complete.",
      ],
      parameters: finishFramerWorkSchema,
      executionMode: "sequential",
      async execute(_id, input: FinishFramerWorkInput) {
        const incomplete = incompleteReviewReason(state);
        if (incomplete) throw new Error(`Completion blocked: ${incomplete}.`);

        const reviewStatus = derivedReviewStatus(state);
        if (reviewStatus === "issues_remain" && input.unresolvedIssues.length === 0) {
          throw new Error("Completion with issues remaining must list concise user-facing unresolved issues.");
        }
        if (reviewStatus !== "issues_remain" && input.unresolvedIssues.length > 0) {
          throw new Error("Completion evidence is clean; do not report unresolved issues unless checks found issues.");
        }
        const details: FramerCompletionDetails = {
          type: FRAMER_COMPLETION_DETAILS_TYPE,
          summary: input.summary.trim(),
          visibleChanges: input.visibleChanges.map((value) => value.trim()),
          reviewStatus,
          unresolvedIssues: input.unresolvedIssues.map((value) => value.trim()),
          published: state.published,
          ...(state.publicationTarget ? { publicationTarget: state.publicationTarget } : {}),
        };
        completedThisRun = true;
        return {
          content: [{ type: "text" as const, text: "Framer work completed and recorded." }],
          details,
          terminate: true,
        };
      },
    });
  };
}
