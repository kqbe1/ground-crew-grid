import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { computeEndTime } from "@/lib/timeRange";
import { Phone, MapPin, ClipboardList, MessageSquare, KeyRound, UserRound, Building2, StickyNote } from "lucide-react";
import BackButton from "@/components/ui/back-button";

export default function MobileTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  useAuth();
  const [task, setTask] = useState<any>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [sheetSubmitted, setSheetSubmitted] = useState(false);

  useEffect(() => {
    const fetchTask = async () => {
      const { data } = await supabase
        .from("work_tasks")
        .select("*, client_sites(address, name), client_equipment(name, brand, model)")
        .eq("id", id)
        .maybeSingle();

      if (data?.client_id) {
        // Fetch full client info including syndic/locataire/keys/notes
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, name, phone, email, address_intervention, contact_syndic, contact_locataire, syndic_keys_codes, notes_internal")
          .eq("id", data.client_id)
          .maybeSingle();
        setTask({ ...data, clients: clientData ?? null });
      } else {
        setTask({ ...data, clients: null });
      }
    };
    if (id) fetchTask();
    try {
      const interv = localStorage.getItem(`fiche_draft:intervention:${id}`);
      const entr = localStorage.getItem(`fiche_draft:entretien:${id}`);
      setHasDraft(!!(interv || entr));
    } catch { /* ignore */ }
    (async () => {
      if (!id) return;
      const { data } = await supabase
        .from("intervention_sheets")
        .select("id")
        .eq("work_task_id", id)
        .eq("is_draft", false)
        .maybeSingle();
      if (data) setSheetSubmitted(true);
    })();
  }, [id]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasClientExtras = task.clients?.contact_syndic || task.clients?.contact_locataire || task.clients?.syndic_keys_codes || task.clients?.notes_internal;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-2">
        <BackButton variant="ghost" size="icon" />
        <div>
          <h1 className="text-xl font-bold">{task.title}</h1>
          <div className="flex gap-2 mt-1">
            <Badge>{INTERVENTION_TYPE_LABELS[task.intervention_type]}</Badge>
            <Badge variant="outline">{TASK_STATUS_LABELS[task.status]}</Badge>
            {hasDraft && !sheetSubmitted && (
              <Badge className="bg-warning text-warning-foreground">Brouillon</Badge>
            )}
            {sheetSubmitted && (
              <Badge className="bg-success text-success-foreground">Fiche envoyée</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Task details */}
      <Card>
        <CardContent className="py-3 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Horaire</div>
            <div className="font-medium">
              {task.start_time?.slice(0, 5)} → {computeEndTime(task.start_time?.slice(0, 5) ?? "", task.duration_minutes ?? 0)}
            </div>
          </div>
          {task.description && (
            <div>
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="text-sm">{task.description}</div>
            </div>
          )}
          {task.memo_secretariat && (
            <div className="bg-accent/10 rounded-lg p-3">
              <div className="flex items-center gap-1 text-xs text-accent font-medium mb-1">
                <MessageSquare className="w-3 h-3" /> Mémo secrétariat
              </div>
              <div className="text-sm">{task.memo_secretariat}</div>
            </div>
          )}
          {task.material_needed && (
            <div>
              <div className="text-xs text-muted-foreground">Matériel à prévoir</div>
              <div className="text-sm">🔧 {task.material_needed}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client info */}
      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="font-medium">{task.clients?.name}</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            {task.client_sites?.address || task.clients?.address_intervention}
          </div>
        </CardContent>
      </Card>

      {/* Client extra info (syndic, locataire, clés, notes) */}
      {hasClientExtras && (
        <Card>
          <CardContent className="py-3 space-y-3">
            {task.clients.contact_syndic && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <Building2 className="w-3 h-3" /> Contact syndic
                </div>
                <div className="text-sm whitespace-pre-line">{task.clients.contact_syndic}</div>
              </div>
            )}
            {task.clients.contact_locataire && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <UserRound className="w-3 h-3" /> Contact locataire
                </div>
                <div className="text-sm whitespace-pre-line">{task.clients.contact_locataire}</div>
              </div>
            )}
            {task.clients.syndic_keys_codes && (
              <div className="bg-primary/10 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-primary mb-1">
                  <KeyRound className="w-3 h-3" /> Codes / Clés syndic
                </div>
                <div className="text-sm whitespace-pre-line">{task.clients.syndic_keys_codes}</div>
              </div>
            )}
            {task.clients.notes_internal && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <StickyNote className="w-3 h-3" /> Notes internes
                </div>
                <div className="text-sm whitespace-pre-line">{task.clients.notes_internal}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        {task.clients?.phone && (
          <Button variant="outline" className="w-full" onClick={() => window.location.href = `tel:${task.clients.phone}`}>
            <Phone className="w-4 h-4 mr-2" /> Appeler
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            const addr = task.client_sites?.address || task.clients?.address_intervention;
            if (addr) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`);
          }}
        >
          <MapPin className="w-4 h-4 mr-2" /> GPS
        </Button>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={() => navigate(`/mobile/fiche/${task.id}`)}
        disabled={sheetSubmitted}
      >
        <ClipboardList className="w-5 h-5 mr-2" />
        {sheetSubmitted ? "Fiche envoyée" : (hasDraft ? "Reprendre la fiche" : "Compléter la fiche")}
      </Button>
    </div>
  );
}
