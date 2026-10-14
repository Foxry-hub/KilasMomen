interface StepperProps {
  currentStep: number;
  totalSteps?: number;
}

const STEP_LABELS = ["BAYAR", "FRAME", "FOTO", "PILIH", "FILTER", "CETAK"];

export function Stepper({ currentStep, totalSteps = 6 }: StepperProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  "w-12 h-12 flex items-center justify-center",
                  "border-4 border-ink font-display text-lg",
                  isActive
                    ? "bg-brand-yellow shadow-brut"
                    : isCompleted
                      ? "bg-brand-green shadow-brut-sm"
                      : "bg-white",
                ].join(" ")}
              >
                {isCompleted ? "✓" : stepNum}
              </div>
              <span
                className={[
                  "mt-1 text-xs font-display uppercase tracking-tight",
                  isActive ? "text-ink" : "text-ink/50",
                ].join(" ")}
              >
                {STEP_LABELS[i] || `STEP ${stepNum}`}
              </span>
            </div>

            {/* Connector line */}
            {stepNum < totalSteps && (
              <div
                className={[
                  "w-6 h-1 border-t-4 mt-[-18px]",
                  isCompleted ? "border-brand-green" : "border-ink/20",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
