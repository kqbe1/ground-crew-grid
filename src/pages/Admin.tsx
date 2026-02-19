import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_LEVEL_LABELS } from "@/lib/constants";
import { Users, Shield, UserCog, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [binomes, setBinomes] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const [usersRes, rolesRes, binomesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("*"),
        supabase.from("binomes").select("*, p1:profiles!binomes_user1_id_fkey(full_name), p2:profiles!binomes_user2_id_fkey(full_name)"),
      ]);

      const rolesMap = new Map<string, string>();
      (rolesRes.data ?? []).forEach((r: any) => rolesMap.set(r.user_id, r.role));

      setUsers(
        (usersRes.data ?? []).map((u: any) => ({
          ...u,
          role: rolesMap.get(u.id) || null,
        }))
      );
      setBinomes(binomesRes.data ?? []);
    };
    fetchAll();
  }, []);

  const assignRole = async (userId: string, role: string) => {
    // Upsert role
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: role as any }, { onConflict: "user_id,role" });
    
    if (error) {
      // If there's an existing different role, delete it first
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error: err2 } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (err2) {
        toast({ title: "Erreur", description: err2.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Rôle mis à jour" });
    // Refresh
    const { data } = await supabase.from("user_roles").select("*");
    setUsers((prev) =>
      prev.map((u) => {
        const found = data?.find((r: any) => r.user_id === u.id);
        return { ...u, role: found?.role || null };
      })
    );
  };

  const updateWorkerLevel = async (userId: string, level: string) => {
    await supabase.from("profiles").update({ worker_level: level as any }).eq("id", userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, worker_level: level } : u)));
    toast({ title: "Niveau mis à jour" });
  };

  const roleColors: Record<string, string> = {
    admin: "bg-destructive text-destructive-foreground",
    secretariat: "bg-secondary text-secondary-foreground",
    ouvrier: "bg-primary text-primary-foreground",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-muted-foreground">Gestion des utilisateurs, rôles et binômes</p>
      </div>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Utilisateurs ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{user.full_name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>

                <Select value={user.role || ""} onValueChange={(v) => assignRole(user.id, v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Rôle..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="secretariat">Secrétariat</SelectItem>
                    <SelectItem value="ouvrier">Ouvrier</SelectItem>
                  </SelectContent>
                </Select>

                {user.role === "ouvrier" && (
                  <Select value={user.worker_level || ""} onValueChange={(v) => updateWorkerLevel(user.id, v)}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Niveau..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T0">T0 - Apprenti</SelectItem>
                      <SelectItem value="T1">T1 - Ouvrier</SelectItem>
                      <SelectItem value="T2">T2 - Chef</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {user.role && (
                  <Badge className={roleColors[user.role]}>{user.role}</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Binomes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" /> Binômes ({binomes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {binomes.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {b.p1?.full_name} ({b.user1_percentage}%) + {b.p2?.full_name} ({b.user2_percentage}%)
                  </div>
                </div>
                <Badge variant={b.is_active ? "default" : "outline"}>
                  {b.is_active ? "Actif" : "Inactif"}
                </Badge>
              </div>
            ))}
            {binomes.length === 0 && (
              <div className="text-center text-muted-foreground py-4">Aucun binôme configuré</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
