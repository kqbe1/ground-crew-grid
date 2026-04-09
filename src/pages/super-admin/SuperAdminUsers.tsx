import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ALL_ROLES = ["admin", "bureau", "ouvrier"] as const;

const roleBadgeClass: Record<string, string> = {
  super_admin: "bg-amber-600 text-white",
  admin: "bg-destructive text-destructive-foreground",
  bureau: "bg-blue-600 text-white",
  ouvrier: "bg-green-600 text-white",
};

export default function SuperAdminUsers() {
  const queryClient = useQueryClient();
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  // Create form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("ouvrier");
  const [newCompanyId, setNewCompanyId] = useState<string>("");

  const { data: companies = [] } = useQuery({
    queryKey: ["sa-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, display_name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["sa-profiles-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const filteredProfiles = filterCompany === "all"
    ? profiles
    : profiles.filter((p) => p.company_id === filterCompany);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: newEmail, password: newPassword, full_name: newName, role: newRole, company_id: newCompanyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-profiles-full"] });
      toast.success("Utilisateur créé");
      setCreateOpen(false);
      setNewEmail(""); setNewPassword(""); setNewName(""); setNewRole("ouvrier"); setNewCompanyId("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; role: string; is_active: boolean; company_id: string }) => {
      const { error } = await supabase.from("profiles").update({
        role: updates.role as any,
        is_active: updates.is_active,
        company_id: updates.company_id,
      }).eq("id", updates.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-profiles-full"] });
      toast.success("Utilisateur mis à jour");
      setEditingProfile(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return "—";
    const c = companies.find((co) => co.id === companyId);
    return c?.display_name || c?.name || "—";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground">{filteredProfiles.length} utilisateur(s)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nouvel utilisateur
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label>Entreprise :</Label>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entreprises</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.display_name || c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users list */}
      <div className="grid gap-3">
        {filteredProfiles.map((p) => (
          <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
            <CardContent className="flex items-center justify-between py-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.full_name}</span>
                  <Badge className={roleBadgeClass[p.role || "ouvrier"]}>{p.role || "ouvrier"}</Badge>
                  {!p.is_active && <Badge variant="outline">Inactif</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {p.email} · {getCompanyName(p.company_id)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingProfile({ ...p })}>
                <Pencil className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <Select value={newCompanyId} onValueChange={setNewCompanyId}>
                <SelectTrigger><SelectValue placeholder="Choisir une entreprise" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newEmail || !newPassword || !newName || !newCompanyId || createMutation.isPending}
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier {editingProfile?.full_name}</DialogTitle></DialogHeader>
          {editingProfile && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select
                  value={editingProfile.role || "ouvrier"}
                  onValueChange={(v) => setEditingProfile({ ...editingProfile, role: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entreprise</Label>
                <Select
                  value={editingProfile.company_id || ""}
                  onValueChange={(v) => setEditingProfile({ ...editingProfile, company_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.display_name || c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingProfile.is_active}
                  onCheckedChange={(v) => setEditingProfile({ ...editingProfile, is_active: v })}
                />
                <Label>Actif</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Annuler</Button>
            <Button
              onClick={() => updateMutation.mutate(editingProfile)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
