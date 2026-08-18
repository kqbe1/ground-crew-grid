import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BackButton from "@/components/ui/back-button";
import { INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { format } from "date-fns";

/**
 * Création d'une fiche d'intervention urgente depuis le mobile,
 * sans tâche préalablement assignée : on crée la tâche du jour
 * assignée à l'ouvrier puis on ouvre le formulaire de fiche.
 */
export default function MobileNouvelleFiche() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("Intervention urgente");
  const [type, setType] = useState("depannage");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.rpc("get_my_clients_safe").then(({ data }) => setClients(data ?? []));
  }, []);

  const start = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("Le titre est obligatoire"); return; }
    setLoading(true);
    const now = new Date();
    const { data, error } = await supabase
      .from("work_tasks")
      .insert({
        title: title.trim(),
        intervention_type: type as any,
        status: "planifie" as any,
        scheduled_date: format(now, "yyyy-MM-dd"),
        start_time: format(now, "HH:mm"),
        duration_minutes: 60,
        assigned_to: user.id,
        client_id: clientId || null,
        created_by: user.id,
      } as any)
      .select("id")
      .single();
    setLoading(false);
    if (error || !data) { toast.error(error?.message || "Création impossible"); return; }
    navigate(`/mobile/fiche/${data.id}`);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BackButton size="icon" variant="ghost" />
        <h1 className="text-xl font-bold">Nouvelle fiche</h1>
      </div>

      <div className="space-y-2">
        <Label>Client</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}{c.city ? ` — ${c.city}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Titre *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Type d'intervention</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(INTERVENTION_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button className="w-full" onClick={start} disabled={loading}>
        {loading ? "Création..." : "Commencer la fiche"}
      </Button>
    </div>
  );
}
