import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import CreateUserDialog from "@/components/admin/CreateUserDialog";

const roleColors: Record<string, string> = {
  super_admin: "bg-amber-600 text-white",
  admin: "bg-destructive text-destructive-foreground",
  bureau: "bg-blue-600 text-white",
  secretariat: "bg-secondary text-secondary-foreground",
  ouvrier: "bg-primary text-primary-foreground",
};

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  bureau: "Bureau",
  secretariat: "Secrétariat",
  ouvrier: "Ouvrier",
};

export default function AdminUsersTab() {
  const { role, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const isSuperAdmin = role === "super_admin";

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    setUsers(data ?? []);
  };

  useEffect(() => { fetchUsers(); }, []);

  const isTargetProtected = (targetRole: string | null) =>
    targetRole === "admin" || targetRole === "super_admin";

  const canChangeRole = (u: any) => {
    if (isSuperAdmin) return true;
    if (isTargetProtected(u.role)) return false;
    if (u.id === user?.id) return false;
    return true;
  };

  const canToggleActive = (u: any) => {
    if (isSuperAdmin) return u.id !== user?.id;
    if (u.id === user?.id) return false;
    if (isTargetProtected(u.role)) return false;
    return true;
  };

  const assignRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.from("profiles").update({ role: newRole as any }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Rôle mis à jour");
    fetchUsers();
  };

  const updateWorkerLevel = async (userId: string, level: string) => {
    await supabase.from("profiles").update({ worker_level: level as any }).eq("id", userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, worker_level: level } : u)));
    toast.success("Niveau mis à jour");
  };

  const toggleActive = async (userId: string, active: boolean) => {
    await supabase.from("profiles").update({ is_active: active }).eq("id", userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: active } : u)));
    toast.success(active ? "Utilisateur activé" : "Utilisateur désactivé");
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Utilisateurs</CardTitle>
            <p className="text-sm text-muted-foreground">{activeCount} actif(s) sur {users.length}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Nouvel utilisateur
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.map((u) => {
            const isSelf = u.id === user?.id;
            return (
              <div key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border ${!u.is_active ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {u.full_name}
                    {u.role === "super_admin" && <ShieldAlert className="w-4 h-4 text-amber-600" />}
                    {isSelf && <span className="text-xs text-muted-foreground">(vous)</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                </div>

                <Select
                  value={u.role || ""}
                  onValueChange={(v) => assignRole(u.id, v)}
                  disabled={!canChangeRole(u)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Rôle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                    {(isSuperAdmin || role === "admin") && <SelectItem value="admin">Admin</SelectItem>}
                    <SelectItem value="bureau">Bureau</SelectItem>
                    <SelectItem value="secretariat">Secrétariat</SelectItem>
                    <SelectItem value="ouvrier">Ouvrier</SelectItem>
                  </SelectContent>
                </Select>

                {u.role === "ouvrier" && (
                  <Select value={u.worker_level || ""} onValueChange={(v) => updateWorkerLevel(u.id, v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Niveau..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T0">T0 - Apprenti</SelectItem>
                      <SelectItem value="T1">T1 - Ouvrier</SelectItem>
                      <SelectItem value="T2">T2 - Chef</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={u.is_active}
                    onCheckedChange={(v) => toggleActive(u.id, v)}
                    disabled={!canToggleActive(u)}
                  />
                  {u.role && (
                    <Badge className={roleColors[u.role] || ""}>
                      {roleLabels[u.role] || u.role}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-6">Aucun utilisateur trouvé</div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchUsers}
        callerRole={role || ""}
      />
    </>
  );
}
