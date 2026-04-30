import type { Severity } from "@/lib/types";

const styles: Record<Severity, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-blue-100 text-blue-800",
  INFORMATIONAL: "bg-gray-100 text-gray-600",
};

interface SeverityBadgeProps {
  severity: Severity;
}

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full uppercase ${styles[severity]}`}>
      {severity}
    </span>
  );
}
