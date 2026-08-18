import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { computeEndTime } from "@/lib/timeRange";
import { ChevronLeft, ChevronRight, Phone, MapPin, MessageSquare, Package, CheckCircle2, Pencil, Send, AlertTriangle, Plus } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import MemosSecretariatPanel from "@/components/mobile/MemosSecretariatPanel";
import FichesEnRetardPanel, { LateTask } from "@/components/mobile/FichesEnRetardPanel";

function hasDraftFor(id: string): boolean {
  try {
    return !!(localStorage.getItem(`fiche_draft:intervention:${id}`) ||
              localStorage.getItem(`fiche_draft:entretien:${id}`));
  } catch { return false; }
}

interface Task {
  id: string;
  title: string;
  start_time: string;
  duration_minutes: number;
  intervention_type: string;
  status: string;
  description: string | null;
  memo_secretariat: string | null;
  material_needed: string | null;
  scheduled_date: string;
  clients: { name: string; phone: string | null; address_intervention: string | null; postal_code: string | null; city: string | null } | null;
  client_sites: { address: string; postal_code: string | null; city: string | null } | null;
  sheet_submitted?: boolean;
  sheet_status: "draft" | "submitted" | "completed" | null;
  is_late?: boolean;
}

export default function MobileAgenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(() => {
    const saved = sessionStorage.getItem("mobile-agenda-date");
    return saved ? new Date(saved) : new Date();
  });

  useEffect(() => {
    sessionStorage.setItem("mobile-agenda-date", currentDate.toISOString());
  }, [currentDate]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [lateTasks, setLateTasks] = useState<LateTask[]>([]);

  const dayStr = format(currentDate, "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const [tasksRes, clientsRes, sheetsRes, lateRes] = await Promise.all([
        supabase
          .from("work_tasks")
          .select("*, client_sites(address, postal_code, city)")
          .eq("assigned_to", user.id)
          .eq("scheduled_date", dayStr)
          .order("start_time"),
        supabase.rpc("get_my_clients_safe"),
        supabase
          .from("intervention_sheets")
          .select("work_task_id, is_draft, final_status")
          .eq("worker_id", user.id),
        supabase
          .from("work_tasks")
          .select("id, title, start_time, scheduled_date, client_id")
          .eq("assigned_to", user.id)
          .lt("scheduled_date", today)
          .order("scheduled_date", { ascending: false }),
      ]);

      const clientMap = Object.fromEntries(
        (clientsRes.data ?? []).map((c: any) => [c.id, c])
      );
      const sheetMap = new Map<string, { is_draft: boolean; final_status: string | null }>();
      (sheetsRes.data ?? []).forEach((s: any) => {
        sheetMap.set(s.work_task_id, { is_draft: s.is_draft, final_status: s.final_status });
      });

      const computeStatus = (id: string): Task["sheet_status"] => {
        const sheet = sheetMap.get(id);
        // Une fiche envoyée reste "envoyée" même si un vieux brouillon local traîne
        if (sheet && !sheet.is_draft) {
          return sheet.final_status === "termine" ? "completed" : "submitted";
        }
        if (hasDraftFor(id) || sheet?.is_draft) return "draft";
        return null;
      };

      const enriched = (tasksRes.data ?? []).map((t: any) => {
        const sheet_status = computeStatus(t.id);
        return {
          ...t,
          clients: t.client_id ? clientMap[t.client_id] ?? null : null,
          sheet_submitted: sheet_status === "submitted" || sheet_status === "completed",
          sheet_status,
          is_late: t.scheduled_date < today && sheet_status !== "submitted" && sheet_status !== "completed",
        };
      });
      setTasks(enriched as Task[]);

      const late = (lateRes.data ?? [])
        .filter((t: any) => {
          const st = computeStatus(t.id);
          return st !== "submitted" && st !== "completed";
        })
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          start_time: t.start_time,
          scheduled_date: t.scheduled_date,
          clientName: t.client_id ? clientMap[t.client_id]?.name ?? null : null,
        }));
      setLateTasks(late);
    };
    fetchTasks();
  }, [dayStr, user]);

  const goBack = () => setCurrentDate((d) => subDays(d, 1));
  const goForward = () => setCurrentDate((d) => addDays(d, 1));

  const headerLabel = useMemo(() => (
    <div className="flex items-baseline gap-2 justify-center">
      <span className="text-base font-bold capitalize">{format(currentDate, "EEEE", { locale: fr })}</span>
      <span className="text-sm text-muted-foreground">{format(currentDate, "d MMMM yyyy", { locale: fr })}</span>
    </div>
  ), [currentDate]);

  return (
    <div className="p-4 space-y-3">
      <FichesEnRetardPanel tasks={lateTasks} />
      <MemosSecretariatPanel tasks={tasks} />

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        {headerLabel}
        <Button variant="ghost" size="icon" onClick={goForward}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <Button variant="outline" className="w-full" onClick={() => navigate("/mobile/fiche/nouvelle")}>
        <Plus className="w-4 h-4 mr-1" /> Nouvelle fiche d'intervention
      </Button>

      <DayView tasks={tasks} navigate={navigate} />
    </div>
  );
}

/* ─── Day View ─── */
function DayView({ tasks, navigate }: { tasks: Task[]; navigate: (path: string) => void }) {
  if (tasks.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <div className="text-4xl mb-2">📋</div>
        Aucune tâche ce jour
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} navigate={navigate} />
      ))}
    </div>
  );
}

/* ─── Task Card ─── */
function TaskCard({ task, navigate }: { task: Task; navigate: (path: string) => void }) {
  return (
    <Card
      className={cn(
        "animate-slide-in cursor-pointer active:scale-[0.98] transition-transform border-l-4",
        task.is_late && "border-l-destructive bg-destructive/5",
        !task.is_late && task.sheet_status === "draft" && "border-l-status-replanifier bg-status-replanifier/5",
        !task.is_late && task.sheet_status === "submitted" && "border-l-status-planifie bg-status-planifie/5",
        !task.is_late && task.sheet_status === "completed" && "border-l-status-termine bg-status-termine/5",
        !task.is_late && !task.sheet_status && "border-l-transparent",
      )}
      onClick={() => navigate(`/mobile/tache/${task.id}`)}
    >
      <CardContent className="py-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-primary">
              {task.start_time?.slice(0, 5)} → {computeEndTime(task.start_time?.slice(0, 5) ?? "", task.duration_minutes ?? 0)}
            </div>
            <div className="font-semibold">{task.title}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={cn("text-xs", INTERVENTION_TYPE_COLORS[task.intervention_type])}>
              {INTERVENTION_TYPE_LABELS[task.intervention_type]}
            </Badge>
            {task.is_late && (
              <Badge variant="outline" className="text-[10px] gap-1 badge-sheet-late">
                <AlertTriangle className="w-3 h-3" /> Fiche à envoyer
              </Badge>
            )}
            {!task.is_late && task.sheet_status === "draft" && (
              <Badge variant="outline" className="text-[10px] gap-1 badge-sheet-draft">
                <Pencil className="w-3 h-3" /> Brouillon
              </Badge>
            )}
            {task.sheet_status === "submitted" && (
              <Badge variant="outline" className="text-[10px] gap-1 badge-sheet-submitted">
                <Send className="w-3 h-3" /> Envoyé au bureau
              </Badge>
            )}
            {task.sheet_status === "completed" && (
              <Badge variant="outline" className="text-[10px] gap-1 badge-sheet-completed">
                <CheckCircle2 className="w-3 h-3" /> Terminé
              </Badge>
            )}
          </div>
        </div>

        {task.description && <div className="text-sm text-muted-foreground">{task.description}</div>}

        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="truncate">
            {(() => {
              const addr = task.client_sites?.address || task.clients?.address_intervention || "";
              const postal = task.client_sites?.postal_code || task.clients?.postal_code || "";
              const city = task.client_sites?.city || task.clients?.city || "";
              const locality = [postal, city].filter(Boolean).join(" ");
              return locality ? `${addr} — ${locality}` : addr;
            })()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{task.clients?.name}</div>
          <div className="flex gap-1.5">
            {task.memo_secretariat && (
              <div className="p-1 rounded bg-accent/10">
                <MessageSquare className="w-3.5 h-3.5 text-accent" />
              </div>
            )}
            {task.status === "piece_a_commander" && (
              <div className="p-1 rounded bg-secondary/10">
                <Package className="w-3.5 h-3.5 text-secondary" />
              </div>
            )}
          </div>
        </div>

        {task.material_needed && (
          <div className="text-xs bg-muted rounded-md px-2 py-1">
            🔧 {task.material_needed}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {task.clients?.phone && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${task.clients!.phone}`;
              }}
            >
              <Phone className="w-3.5 h-3.5 mr-1" /> Appeler
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              const addr = task.client_sites?.address || task.clients?.address_intervention || "";
              const postal = task.client_sites?.postal_code || task.clients?.postal_code || "";
              const city = task.client_sites?.city || task.clients?.city || "";
              const fullAddr = [addr, postal, city].filter(Boolean).join(", ");
              if (fullAddr) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`);
            }}
          >
            <MapPin className="w-3.5 h-3.5 mr-1" /> GPS
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
