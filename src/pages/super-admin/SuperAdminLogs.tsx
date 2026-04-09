import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollText, User, Building2, ListTodo, Shield, LogIn, UserPlus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

const ACTION_ICONS: Record<string, any> = {
  login: LogIn,
  create_user: UserPlus,
  update_user: Pencil,
  update_user_credentials: Shield,
  delete_user: Trash2,
  create_company: Building2,
  update_company: Pencil,
  create_task: ListTodo,
  update_role: Shield,
};

const ACTION_LABELS: Record<string, string> = {
  login: "Connexion",
  create_user: "Création utilisateur",
  update_user: "Modification utilisateur",
  update_user_credentials: "Modification identifiants",
  delete_user: "Suppression utilisateur",
  create_company: "Création entreprise",
  update_company: "Modification entreprise",
  create_task: "Création tâche",
  update_role: "Changement de rôle",
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-blue-100 text-blue-700",
  create_user: "bg-green-100 text-green-700",
  create_company: "bg-green-100 text-green-700",
  update_user: "bg-amber-100 text-amber-700",
  update_user_credentials: "bg-orange-100 text-orange-700",
  update_company: "bg-amber-100 text-amber-700",
  update_role: "bg-purple-100 text-purple-700",
  delete_user: "bg-red-100 text-red-700",
};

export default function SuperAdminLogs() {
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["sa-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["sa-profiles-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["sa-companies-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, display_name");
      if (error) throw error;
      return data;
    },
  });

  const getActorName = (id: string | null) => {
    if (!id) return "Système";
    const p = profiles.find((pr) => pr.id === id);
    return p?.full_name || p?.email || id.slice(0, 8);
  };

  const getCompanyName = (id: string | null) => {
    if (!id) return null;
    const c = companies.find((co) => co.id === id);
    return c?.display_name || c?.name || null;
  };

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  const filtered = logs.filter((l) => {
    if (filterAction !== "all" && l.action !== filterAction) return false;
    if (filterCompany !== "all" && l.company_id !== filterCompany) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
          <ScrollText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Journal d'activité</h1>
          <p className="text-muted-foreground">{filtered.length} événement(s)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Action :</Label>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {uniqueActions.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABELS[a] || a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Entreprise :</Label>
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.display_name || c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs list */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              Aucun événement enregistré
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((log) => {
                const Icon = ACTION_ICONS[log.action] || ScrollText;
                const colorClass = ACTION_COLORS[log.action] || "bg-muted text-muted-foreground";
                const companyName = getCompanyName(log.company_id);

                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
                    <div className={`p-1.5 rounded-md mt-0.5 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        {companyName && (
                          <Badge variant="outline" className="text-[10px]">
                            {companyName}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        par {getActorName(log.actor_id)} ·{" "}
                        {format(new Date(log.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                      </div>
                      {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                        <div className="text-[11px] text-muted-foreground/70 mt-1 font-mono truncate">
                          {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
