import type { Phase } from "@/lib/types";

const phases: Phase[] = ["INGESTION", "GENERATION", "FUNCTIONAL", "PERFORMANCE", "SECURITY", "COMPLETE"];

interface PhaseProgressBarProps {
  currentPhase: Phase;
}

export default function PhaseProgressBar({ currentPhase }: PhaseProgressBarProps) {
  const currentIndex = phases.indexOf(currentPhase);

  return (
    <div className="flex items-center w-full">
      {phases.map((phase, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={phase} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  isCompleted
                    ? "bg-success text-white border-success"
                    : isCurrent
                      ? "bg-primary text-white border-primary"
                      : "bg-surface text-on-surface-variant border-border"
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isCurrent ? "text-primary" : "text-on-surface-variant"}`}>
                {phase === "COMPLETE" ? "DONE" : phase.slice(0, 4)}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mt-[-16px] ${i < currentIndex ? "bg-success" : "bg-border-light"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
