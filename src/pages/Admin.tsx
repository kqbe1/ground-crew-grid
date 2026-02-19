import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_LEVEL_LABELS, INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { Users, UserCog, FileText, Plus, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import CreateEditBinomeDialog from "@/components/admin/CreateEditBinomeDialog";
import CreateEditTemplateDialog from "@/components/admin/CreateEditTemplateDialog";

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [binomes, setBinomes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Dialogs
  const [binomeDialog, setBinomeDialog] = useState(false);
  const [editBinome, setEditBinome] = useState<any>(null);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);

  const fetchAll = async () => {
    const [usersRes, rolesRes, binomesRes, templatesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("user_roles").select("*"),
      supabase.from("binomes").select("*, p1:profiles!binomes_user1_id_fkey(full_name), p2:profiles!binomes_user2_id_fkey(full_name)").order("name"),
      supabase.from("task_templates").select("*").order("name"),
    ]);

    const rolesMap = new Map<string, string>();
    (rolesRes.data ?? []).forEach((r: any) => rolesMap.set(r.user_id, r.role));

    setUsers(
      (usersRes.data ?? []).map((u: any) => ({ ...u, role: rolesMap.get(u.id) || null }))
    );
    setBinomes(binomesRes.data ?? []);
    setTemplates(templatesRes.data ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const workers = users.filter((u) => u.role === "ouvrier");

  const assignRole = async (userId: string, role: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) { toast.error(error.message); return; }
    toast.success("Rôle mis à jour");
    fetchAll();
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

  const toggleBinomeActive = async (id: string, active: boolean) => {
    await supabase.from("binomes").update({ is_active: active }).eq("id", id);
    setBinomes((prev) => prev.map((b) => (b.id === id ? { ...b, is_active: active } : b)));
    toast.success(active ? "Binôme activé" : "Binôme désactivé");
  };

  const deleteBinome = async (id: string) => {
    await supabase.from("binomes").delete().eq("id", id);
    toast.success("Binôme supprimé");
    fetchAll();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("task_templates").delete().eq("id", id);
    toast.success("Template supprimé");
    fetchAll();
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
        <p className="text-muted-foreground">Gestion des utilisateurs, binômes et templates</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Utilisateurs</TabsTrigger>
          <TabsTrigger value="binomes" className="gap-1.5"><UserCog className="w-4 h-4" /> Binômes</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><FileText className="w-4 h-4" /> Templates</TabsTrigger>
        </TabsList>

        {/* ===== UTILISATEURS ===== */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Utilisateurs ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className={`flex items-center gap-3 p-3 rounded-lg border ${!user.is_active ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>

                  <Select value={user.role || ""} onValueChange={(v) => assignRole(user.id, v)}>
                    <SelectTrigger className="w-[130px]">
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
                    <Switch checked={user.is_active} onCheckedChange={(v) => toggleActive(user.id, v)} />
                    {user.role && <Badge className={roleColors[user.role]}>{user.role}</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== BINÔMES ===== */}
        <TabsContent value="binomes" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Binômes ({binomes.length})</CardTitle>
              <Button size="sm" onClick={() => { setEditBinome(null); setBinomeDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Nouveau binôme
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {binomes.map((b) => (
                <div key={b.id} className={`flex items-center gap-3 p-3 rounded-lg border ${!b.is_active ? "opacity-50" : ""}`}>
                  <div className="flex-1">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {b.p1?.full_name} ({b.user1_percentage}%) + {b.p2?.full_name} ({b.user2_percentage}%)
                    </div>
                  </div>
                  <Switch checked={b.is_active} onCheckedChange={(v) => toggleBinomeActive(b.id, v)} />
                  <Button variant="ghost" size="icon" onClick={() => { setEditBinome(b); setBinomeDialog(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteBinome(b.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {binomes.length === 0 && (
                <div className="text-center text-muted-foreground py-6">Aucun binôme configuré</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TEMPLATES ===== */}
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Templates de fiches ({templates.length})</CardTitle>
              <Button size="sm" onClick={() => { setEditTemplate(null); setTemplateDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Nouveau template
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {t.name}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${INTERVENTION_TYPE_COLORS[t.intervention_type]}`}>
                        {INTERVENTION_TYPE_LABELS[t.intervention_type]}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t.default_duration_minutes} min · {Array.isArray(t.checklist) ? t.checklist.length : 0} points de contrôle
                    </div>
                    {t.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</div>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setEditTemplate(t); setTemplateDialog(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteTemplate(t.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-center text-muted-foreground py-6">Aucun template configuré</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateEditBinomeDialog
        open={binomeDialog}
        onOpenChange={setBinomeDialog}
        binome={editBinome}
        workers={workers}
        onSaved={fetchAll}
      />
      <CreateEditTemplateDialog
        open={templateDialog}
        onOpenChange={setTemplateDialog}
        template={editTemplate}
        onSaved={fetchAll}
      />
    </div>
  );
}
