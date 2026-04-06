import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_LEVEL_LABELS, INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { Users, FileText, Plus, Pencil, Trash2, ShieldAlert, Printer, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import CreateEditTemplateDialog from "@/components/admin/CreateEditTemplateDialog";
import { useAuth } from "@/hooks/useAuth";
import PdfSettingsTab from "@/components/admin/PdfSettingsTab";
import AdminStatsTab from "@/components/admin/AdminStatsTab";

export default function Admin() {
  const { role, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);

  const isSuperAdmin = role === "super_admin";

  const fetchAll = async () => {
    const [usersRes, rolesRes, templatesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("user_roles").select("*"),
      supabase.from("task_templates").select("*").order("name"),
    ]);

    const rolesMap = new Map<string, string>();
    (rolesRes.data ?? []).forEach((r: any) => rolesMap.set(r.user_id, r.role));

    setUsers(
      (usersRes.data ?? []).map((u: any) => ({ ...u, role: rolesMap.get(u.id) || null }))
    );
    setTemplates(templatesRes.data ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  // Defense-in-depth: block non-admin access at component level
  if (role && role !== "admin" && role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  const isTargetProtected = (targetRole: string | null) => {
    return targetRole === "admin" || targetRole === "super_admin";
  };

  const canModifyUser = (targetUser: any) => {
    if (isSuperAdmin) return true;
    // Admin cannot modify admins or super_admins
    if (isTargetProtected(targetUser.role)) return false;
    // Admin cannot modify themselves (deactivation)
    return true;
  };

  const canToggleActive = (targetUser: any) => {
    if (isSuperAdmin) {
      // Super admin cannot deactivate themselves
      return targetUser.id !== user?.id;
    }
    // Admin cannot deactivate themselves or other admins/super_admins
    if (targetUser.id === user?.id) return false;
    if (isTargetProtected(targetUser.role)) return false;
    return true;
  };

  const canChangeRole = (targetUser: any) => {
    if (isSuperAdmin) return true;
    // Admin cannot change role of admins/super_admins
    if (isTargetProtected(targetUser.role)) return false;
    // Admin cannot change their own role
    if (targetUser.id === user?.id) return false;
    return true;
  };

  const assignRole = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
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

  const deleteTemplate = async (id: string) => {
    await supabase.from("task_templates").delete().eq("id", id);
    toast.success("Template supprimé");
    fetchAll();
  };

  const roleColors: Record<string, string> = {
    super_admin: "bg-amber-600 text-white",
    admin: "bg-destructive text-destructive-foreground",
    secretariat: "bg-secondary text-secondary-foreground",
    ouvrier: "bg-primary text-primary-foreground",
  };

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    secretariat: "Secrétariat",
    ouvrier: "Ouvrier",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-muted-foreground">Gestion des utilisateurs et templates</p>
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Statistiques</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Utilisateurs</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><FileText className="w-4 h-4" /> Templates</TabsTrigger>
          <TabsTrigger value="pdf" className="gap-1.5"><Printer className="w-4 h-4" /> Config PDF</TabsTrigger>
        </TabsList>

        {/* ===== STATISTIQUES ===== */}
        <TabsContent value="stats" className="mt-4">
          <AdminStatsTab />
        </TabsContent>

        {/* ===== UTILISATEURS ===== */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Utilisateurs ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {users.map((u) => {
                const isProtected = isTargetProtected(u.role);
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
                        <SelectItem value="admin">Admin</SelectItem>
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

        {/* ===== CONFIG PDF ===== */}
        <TabsContent value="pdf" className="mt-4">
          <PdfSettingsTab />
        </TabsContent>
      </Tabs>

      <CreateEditTemplateDialog
        open={templateDialog}
        onOpenChange={setTemplateDialog}
        template={editTemplate}
        onSaved={fetchAll}
      />
    </div>
  );
}
