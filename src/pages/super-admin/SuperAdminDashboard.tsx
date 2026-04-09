import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, ListTodo, AlertTriangle } from "lucide-react";
import { format, addDays, isBefore } from "date-fns";
import { fr } from "date-fns/locale";

export default function SuperAdminDashboard() {
  const { data: companies = [] } = useQuery({
    queryKey: ["sa-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["sa-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, role, company_id, is_active");
      if (error) throw error;
      return data;
    },
  });

  const { data: taskCount = 0 } = useQuery({
    queryKey: ["sa-task-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("work_tasks").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const activeCompanies = companies.filter((c) => c.is_active);
  const activeUsers = profiles.filter((p) => p.is_active);
  const expiringCompanies = companies.filter((c) => {
    if (!c.subscription_end) return false;
    return isBefore(new Date(c.subscription_end), addDays(new Date(), 30));
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>
        <p className="text-muted-foreground">Vue globale de toutes les entreprises</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entreprises actives</p>
                <p className="text-2xl font-bold">{activeCompanies.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Utilisateurs actifs</p>
                <p className="text-2xl font-bold">{activeUsers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                <ListTodo className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tâches totales</p>
                <p className="text-2xl font-bold">{taskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Abo. expirant</p>
                <p className="text-2xl font-bold">{expiringCompanies.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Companies overview */}
      <Card>
        <CardHeader>
          <CardTitle>Entreprises</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Nom</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Utilisateurs</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Fin abo.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {companies.map((company) => {
                  const companyUsers = profiles.filter((p) => p.company_id === company.id && p.is_active);
                  return (
                    <tr key={company.id} className="hover:bg-muted/50">
                      <td className="py-3 font-medium">{company.display_name || company.name}</td>
                      <td className="py-3">
                        <Badge variant="outline" className="capitalize">{company.plan || "standard"}</Badge>
                      </td>
                      <td className="py-3">
                        {companyUsers.length} / {company.max_users || "∞"}
                      </td>
                      <td className="py-3">
                        <Badge className={company.is_active ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}>
                          {company.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {company.subscription_end
                          ? format(new Date(company.subscription_end), "dd MMM yyyy", { locale: fr })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
