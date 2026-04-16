import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  count: number;
  onClick: () => void;
}

export default function BureauReceivedBanner({ active, count, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between rounded-lg px-4 py-3 transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "bg-primary/10 text-primary hover:bg-primary/20"
      )}
    >
      <div className="flex items-center gap-3">
        <Inbox className="w-5 h-5" />
        <span className="font-semibold text-sm">Fiches reçues</span>
      </div>
      {count > 0 && (
        <span className={cn(
          "text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5",
          active ? "bg-white text-primary" : "bg-destructive text-white"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
