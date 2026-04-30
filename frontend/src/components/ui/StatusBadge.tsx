import type { ApprovalStatus, ExecutionStatus, GateStatus, Phase } from "@/lib/types";

type BadgeVariant = ApprovalStatus | ExecutionStatus | GateStatus | Phase;

const variantStyles: Record<string, string> = {
  // Approval
  GENERATED: "bg-info-container text-info",
  MODIFIED: "bg-purple-100 text-purple-700",
  APPROVED: "bg-success-container text-success",
  REJECTED: "bg-error-container text-error",
  SKIPPED: "bg-gray-100 text-gray-600",
  // Execution
  PASSED: "bg-success-container text-success",
  FAILED: "bg-error-container text-error",
  ERROR: "bg-orange-100 text-orange-700",
  TIMEOUT: "bg-warning-container text-warning",
  RUNNING: "bg-info-container text-info",
  // Gate
  PENDING: "bg-warning-container text-warning",
  // Phase
  INGESTION: "bg-blue-100 text-blue-700",
  GENERATION: "bg-purple-100 text-purple-700",
  FUNCTIONAL: "bg-cyan-100 text-cyan-700",
  PERFORMANCE: "bg-amber-100 text-amber-700",
  SECURITY: "bg-red-100 text-red-700",
  COMPLETE: "bg-success-container text-success",
};

interface StatusBadgeProps {
  status: BadgeVariant;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${sizeClass} ${variantStyles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
