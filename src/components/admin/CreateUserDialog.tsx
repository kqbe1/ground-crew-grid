import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  callerRole: string;
}

const ROLES_BY_CALLER: Record<string, string[]> = {
  super_admin: ["admin", "bureau", "secretariat", "ouvrier"],
  admin: ["bureau", "secretariat", "ouvrier"],
};

export default function CreateUserDialog({ open, onOpenChange, onCreated, callerRole }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("ouvrier");
  const [loading, setLoading] = useState(false);

  const allowedRoles = ROLES_BY_CALLER[callerRole] || [];

  const handleCreate = async () => {
    if (!email || !password || !fullName || !role) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email, password, full_name: fullName, role },
      });
      if (data?.error) throw new Error(data.error);
      if (error) {
        // Try to parse the error context for a meaningful message
        const msg = typeof error === 'object' && 'context' in error
          ? (error as any).context?.body
            ? JSON.parse(new TextDecoder().decode((error as any).context.body)).error
            : error.message
          : error.message;
        throw new Error(msg || "Erreur lors de la création");
      }
      toast.success("Utilisateur créé avec succès");
      setEmail(""); setPassword(""); setFullName(""); setRole("ouvrier");
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    bureau: "Bureau",
    secretariat: "Secrétariat",
    ouvrier: "Ouvrier",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un utilisateur</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Nom complet</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jean Dupont" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@exemple.be" />
          </div>
          <div className="space-y-2">
            <Label>Mot de passe</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 caractères" />
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabels[r] || r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={!email || !password || !fullName || loading}>
            {loading ? "Création..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
