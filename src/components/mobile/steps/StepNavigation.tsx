import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, X, Send } from "lucide-react";

interface Props {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  nextDisabled?: boolean;
  isSubmitting?: boolean;
}

export default function StepNavigation({
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onClose,
  nextDisabled = false,
  isSubmitting = false,
}: Props) {
  const isLast = currentStep === totalSteps;

  return (
    <div className="flex items-center justify-between">
      {currentStep > 1 ? (
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour
        </Button>
      ) : (
        <div />
      )}
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive"
        disabled={isSubmitting}
      >
        <X className="w-5 h-5" />
      </button>
      <Button size="sm" onClick={onNext} disabled={nextDisabled || isSubmitting}>
        {isSubmitting ? (
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-1" />
        ) : isLast ? (
          <Send className="w-4 h-4 mr-1" />
        ) : (
          <ArrowRight className="w-4 h-4 mr-1" />
        )}
        {isLast ? "Terminer" : "Suivant"}
      </Button>
    </div>
  );
}
