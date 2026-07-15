import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { INTERVENTION_TYPE_LABELS, INTERVENTION_TYPE_COLORS } from "@/lib/constants";
import { Users, FileText, Plus, Pencil, Trash2, Printer, BarChart3, Settings, Scale, UsersRound, Mail } from "lucide-react";
import { toast } from "sonner";
import CreateEditTemplateDialog from "@/components/admin/CreateEditTemplateDialog";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import { useAuth } from "@/hooks/useAuth";
import PdfSettingsTab from "@/components/admin/PdfSettingsTab";
import AdminStatsTab from "@/components/admin/AdminStatsTab";
import LegalRulesTab from "@/components/admin/LegalRulesTab";
import BinomesTab from "@/components/admin/BinomesTab";
import EmailSettingsTab from "@/components/admin/EmailSettingsTab";
import LayoutPage from "@/components/layout/LayoutPage";

export default function Admin() {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "stats";
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);

  const canManageUsers = role === "super_admin" || role === "admin";

  const fetchTemplates = async () => {
    const { data } = await supabase.from("task_templates").select("*").order("name");
    setTemplates(data ?? []);
  };

  useEffect(() => { fetchTemplates(); }, []);

  if (role && role !== "admin" && role !== "bureau" && role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  const deleteTemplate = async (id: string) => {
    await supabase.from("task_templates").delete().eq("id", id);
    toast.success("Template supprimé");
    fetchTemplates();
  };

  return (
    <LayoutPage icon={Settings} title="Administration">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Statistiques</TabsTrigger>
          {canManageUsers && (
            <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Utilisateurs</TabsTrigger>
          )}
          <TabsTrigger value="templates" className="gap-1.5"><FileText className="w-4 h-4" /> Templates</TabsTrigger>
          <TabsTrigger value="binomes" className="gap-1.5"><UsersRound className="w-4 h-4" /> Binômes</TabsTrigger>
          <TabsTrigger value="legal" className="gap-1.5"><Scale className="w-4 h-4" /> Entretiens légaux</TabsTrigger>
          <TabsTrigger value="pdf" className="gap-1.5"><Printer className="w-4 h-4" /> Config PDF</TabsTrigger>
          <TabsTrigger value="emails" className="gap-1.5"><Mail className="w-4 h-4" /> Emails clients</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <AdminStatsTab />
        </TabsContent>

        {canManageUsers && (
          <TabsContent value="users" className="mt-4">
            <AdminUsersTab />
          </TabsContent>
        )}

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

        <TabsContent value="pdf" className="mt-4">
          <PdfSettingsTab />
        </TabsContent>

        <TabsContent value="legal" className="mt-4">
          <LegalRulesTab />
        </TabsContent>

        <TabsContent value="binomes" className="mt-4">
          <BinomesTab />
        </TabsContent>

        <TabsContent value="emails" className="mt-4">
          <EmailSettingsTab />
        </TabsContent>
      </Tabs>

      <CreateEditTemplateDialog
        open={templateDialog}
        onOpenChange={setTemplateDialog}
        template={editTemplate}
        onSaved={fetchTemplates}
      />
    </LayoutPage>
  );
}
