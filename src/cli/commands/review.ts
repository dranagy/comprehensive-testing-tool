import type { Command } from "commander";

export function registerReviewCommand(program: Command): void {
  const review = program.command("review").description("Review, edit, and approve generated test cases");

  review
    .command("list")
    .description("List test cases awaiting review")
    .option("--phase <phase>", "Filter by phase")
    .action(async (options) => {
      const { reviewList } = await import("./review-impl.js");
      await reviewList(options);
    });

  review
    .command("show <testId>")
    .description("Display full test case details")
    .action(async (testId: string) => {
      const { reviewShow } = await import("./review-impl.js");
      await reviewShow(testId);
    });

  review
    .command("edit <testId>")
    .description("Open test case for editing")
    .action(async (testId: string) => {
      const { reviewEdit } = await import("./review-impl.js");
      await reviewEdit(testId);
    });

  review
    .command("approve [phase]")
    .description("Approve tests in a phase")
    .option("--all", "Approve all pending tests across all phases")
    .action(async (phase: string | undefined, options) => {
      const { reviewApprove } = await import("./review-impl.js");
      await reviewApprove(phase, options);
    });

  review
    .command("reject <testId>")
    .description("Reject a specific test case")
    .option("--reason <reason>", "Rejection reason")
    .action(async (testId: string, options) => {
      const { reviewReject } = await import("./review-impl.js");
      await reviewReject(testId, options);
    });
}
