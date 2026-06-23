import { useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface MemoTask {
  id: string;
  title: string;
  start_time: string | null;
  memo_secretariat: string | null;
  clients?: { name: string } | null;
}

interface Props {
  tasks: MemoTask[];
}

export default function MemosSecretariatPanel({ tasks }: Props) {
  const memos = tasks.filter((t) => t.memo_secretariat && t.memo_secretariat.trim().length > 0);
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  if (memos.length === 0) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <MessageSquare className="w-4 h-4 text-accent" />
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-accent text-[10px] font-bold text-accent-foreground px-1 flex items-center justify-center">
              {memos.length}
            </span>
          </div>
          <span className="text-sm font-semibold">Mémos secrétariat</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <div className={cn("transition-all", open ? "max-h-[60vh] overflow-y-auto" : "max-h-0 overflow-hidden")}>
        <div className="px-3 pb-3 space-y-2">
          {memos.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/mobile/tache/${t.id}`)}
              className="w-full text-left bg-background rounded-lg p-2.5 border border-border active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-primary">{t.start_time?.slice(0, 5) ?? "—"}</span>
                <span className="text-xs font-medium truncate flex-1">{t.title}</span>
                {t.clients?.name && <span className="text-[10px] text-muted-foreground truncate">{t.clients.name}</span>}
              </div>
              <div className="text-sm whitespace-pre-line">{t.memo_secretariat}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}