import { describe, expect, it } from "vitest";
import {
  DESIGN_QUESTION_DETAILS_TYPE,
  createFramerAgentCoreExtension,
  formatDesignQuestionAnswer,
  isDesignQuestionDetails,
  parseDesignQuestionAnswer,
  type AskUserInput,
  type DesignQuestionDetails,
} from "../src/index.js";
import { captureExtensionTools, requireCapturedTool } from "../src/testing.js";

const input: AskUserInput = {
  question: "  Which visual direction should the hero use?  ",
  topic: "visual-style",
  options: [
    { id: "quiet", title: "  Quiet and editorial  ", description: "More whitespace" },
    { id: "bold", title: "Bold and expressive", recommended: true },
  ],
};

describe("public Pi extension seam", () => {
  it("registers and executes a sequential, terminating structured Design Question", async () => {
    const tools = captureExtensionTools(
      createFramerAgentCoreExtension({ createQuestionId: () => "question-1" }),
    );
    const tool = requireCapturedTool(tools, "ask_user");

    expect(tool.executionMode).toBe("sequential");
    const result = (await tool.execute("call-1", input as never)) as {
      terminate: boolean;
      details: DesignQuestionDetails;
      content: readonly { type: string; text: string }[];
    };

    expect(result.terminate).toBe(true);
    expect(result.details).toEqual({
      type: DESIGN_QUESTION_DETAILS_TYPE,
      questionId: "question-1",
      question: "Which visual direction should the hero use?",
      topic: "visual-style",
      options: [
        { id: "quiet", title: "Quiet and editorial", description: "More whitespace" },
        { id: "bold", title: "Bold and expressive", recommended: true },
      ],
      allowOther: false,
      allowDelegation: false,
      toolCallId: "call-1",
    });
    expect(isDesignQuestionDetails(result.details)).toBe(true);
    expect(result.content[0]?.text).toContain("later user message");
  });

  it("rejects duplicate option ids and multiple recommendations", async () => {
    const tool = requireCapturedTool(captureExtensionTools(createFramerAgentCoreExtension()), "ask_user");
    await expect(
      tool.execute("duplicate", {
        question: "Direction?",
        options: [{ id: "same", title: "A" }, { id: "same", title: "B" }],
      } as never),
    ).rejects.toThrow("unique");
    await expect(
      tool.execute("recommended", {
        question: "Direction?",
        options: [
          { id: "a", title: "A", recommended: true },
          { id: "b", title: "B", recommended: true },
        ],
      } as never),
    ).rejects.toThrow("at most one");
  });

  it("keeps registrations and generated question state session-local", async () => {
    let nextId = 0;
    const extension = createFramerAgentCoreExtension({ createQuestionId: () => `q-${++nextId}` });
    const first = requireCapturedTool(captureExtensionTools(extension), "ask_user");
    const second = requireCapturedTool(captureExtensionTools(extension), "ask_user");

    expect(first).not.toBe(second);
    const firstResult = (await first.execute("first", input as never)) as { details: DesignQuestionDetails };
    const secondResult = (await second.execute("second", input as never)) as { details: DesignQuestionDetails };
    expect(firstResult.details.questionId).toBe("q-1");
    expect(secondResult.details.questionId).toBe("q-2");
    expect(firstResult.details.toolCallId).toBe("first");
    expect(secondResult.details.toolCallId).toBe("second");
  });

  it("formats a persisted answer for a later run", async () => {
    const tool = requireCapturedTool(
      captureExtensionTools(createFramerAgentCoreExtension({ createQuestionId: () => "q-answer" })),
      "ask_user",
    );
    const result = (await tool.execute("answer", input as never)) as { details: DesignQuestionDetails };
    expect(
      formatDesignQuestionAnswer(result.details, {
        kind: "option",
        option: result.details.options[1]!,
      }),
    ).toBe("Design Question answer\nQuestion ID: q-answer\nSelected option: bold — Bold and expressive");
  });

  it("formats free-form and delegated answers only when the question allows them", async () => {
    const tool = requireCapturedTool(
      captureExtensionTools(createFramerAgentCoreExtension({ createQuestionId: () => "q-open" })),
      "ask_user",
    );
    const strict = (await tool.execute("strict", input as never)) as { details: DesignQuestionDetails };
    expect(() => formatDesignQuestionAnswer(strict.details, { kind: "other", text: "Something else" })).toThrow(
      /free-form/,
    );
    expect(() => formatDesignQuestionAnswer(strict.details, { kind: "delegation" })).toThrow(/delegation/);

    const open = (await tool.execute("open", {
      ...input,
      allowOther: true,
      allowDelegation: true,
    } as never)) as { details: DesignQuestionDetails };
    expect(formatDesignQuestionAnswer(open.details, { kind: "other", text: "  Split hero  " })).toContain(
      "Designer-provided answer: Split hero",
    );
    expect(formatDesignQuestionAnswer(open.details, { kind: "delegation" })).toContain(
      "The designer delegated this decision",
    );
  });

  it("parses its own answer messages back to a question and display label", async () => {
    const tool = requireCapturedTool(
      captureExtensionTools(createFramerAgentCoreExtension({ createQuestionId: () => "q-parse" })),
      "ask_user",
    );
    const result = (await tool.execute("parse", {
      ...input,
      allowOther: true,
      allowDelegation: true,
    } as never)) as { details: DesignQuestionDetails };

    for (const [answer, display] of [
      [{ kind: "option", option: result.details.options[1]! }, "Bold and expressive"],
      [{ kind: "other", text: "Split hero" }, "Split hero"],
      [{ kind: "delegation" }, "Use your judgment"],
    ] as const) {
      expect(parseDesignQuestionAnswer(formatDesignQuestionAnswer(result.details, answer))).toEqual({
        questionId: "q-parse",
        display,
      });
    }
    expect(parseDesignQuestionAnswer("Just a normal prompt")).toBeUndefined();
  });
});
