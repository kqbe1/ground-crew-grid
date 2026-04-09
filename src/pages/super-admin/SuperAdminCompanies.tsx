import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CompanyForm {
  name: string;
  slug: string;
  display_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  plan: string;
  max_users: number;
  is_active: boolean;
}

const emptyForm: CompanyForm = {
  name: "", slug: "", display_name: "", contact_email: "", contact_phone: "",
  address: "", plan: "standard", max_users: 15, is_active: true,
};

export default function SuperAdminCompanies() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);

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
      const { data, error } = await supabase.from("profiles").select("id, company_id, is_active");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("companies").update(form).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-companies"] });
      toast.success(editingId ? "Entreprise mise à jour" : "Entreprise créée");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (company: any) => {
    setEditingId(company.id);
    setForm({
      name: company.name, slug: company.slug, display_name: company.display_name || "",
      contact_email: company.contact_email || "", contact_phone: company.contact_phone || "",
      address: company.address || "", plan: company.plan || "standard",
      max_users: company.max_users || 15, is_active: company.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const updateField = (field: keyof CompanyForm, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des entreprises</h1>
          <p className="text-muted-foreground">{companies.length} entreprise(s)</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Nouvelle entreprise
        </Button>
      </div>

      <div className="grid gap-4">
        {companies.map((company) => {
          const userCount = profiles.filter((p) => p.company_id === company.id && p.is_active).length;
          const maxUsers = company.max_users || 25;
          const usagePercent = Math.min(Math.round((userCount / maxUsers) * 100), 100);
          const isNearLimit = usagePercent >= 80;
          const isAtLimit = userCount >= maxUsers;
          return (
            <Card key={company.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/super-admin/users?company=${company.id}`)}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{company.display_name || company.name}</span>
                    <Badge className={company.is_active ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}>
                      {company.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="capitalize">{company.plan || "standard"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {company.contact_email}
                  </p>
                  <div className="flex items-center gap-3 max-w-xs">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isAtLimit ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${isAtLimit ? "text-destructive" : isNearLimit ? "text-amber-600" : "text-muted-foreground"}`}>
                      {userCount} / {maxUsers}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/super-admin/users?company=${company.id}`); }} title="Voir les utilisateurs">
                    <Users className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(company); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'entreprise" : "Nouvelle entreprise"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom technique</Label>
                <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => updateField("slug", e.target.value)} placeholder="mon-entreprise" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nom affiché</Label>
              <Input value={form.display_name} onChange={(e) => updateField("display_name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email contact</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => updateField("contact_email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={form.contact_phone} onChange={(e) => updateField("contact_phone", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Input value={form.plan} onChange={(e) => updateField("plan", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Max utilisateurs</Label>
                <Input type="number" value={form.max_users} onChange={(e) => updateField("max_users", parseInt(e.target.value) || 15)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => updateField("is_active", v)} />
              <Label>Entreprise active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.slug || saveMutation.isPending}>
              {saveMutation.isPending ? "..." : editingId ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
