interface Props {
  currentStep: number;
  totalSteps: number;
}

export default function StepProgressBar({ currentStep, totalSteps }: Props) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < currentStep ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}
