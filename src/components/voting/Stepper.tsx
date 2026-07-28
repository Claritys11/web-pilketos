const STEPS = ["Token", "Kandidat", "Konfirmasi", "Selesai"] as const;

interface StepperProps {
  currentStep: 1 | 2 | 3 | 4;
}

export function Stepper({ currentStep }: StepperProps) {
  return (
    <nav aria-label="Progress voting" className="w-full">
      <p className="text-sm font-medium text-[var(--color-vote-muted)] sm:hidden">
        Langkah {currentStep} dari {STEPS.length}
      </p>
      <ol className="hidden grid-cols-4 items-start gap-3 sm:grid">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <li key={label} className="relative flex flex-col items-center gap-2 text-center">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-4 h-px w-full ${
                    isCompleted || isCurrent ? "bg-[var(--color-primary-300)]" : "bg-neutral-200"
                  }`}
                />
              ) : null}
              <span
                className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border text-sm font-semibold ${
                  isCompleted
                    ? "border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-white"
                    : isCurrent
                      ? "border-[var(--color-primary-600)] bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                      : "border-neutral-300 bg-neutral-100 text-neutral-400"
                }`}
              >
                {isCompleted ? "✓" : step}
              </span>
              <span className="text-xs font-medium text-neutral-600">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
