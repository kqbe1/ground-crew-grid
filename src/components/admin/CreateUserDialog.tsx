import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WORKER_LEVELS, WORKER_LEVEL_LABELS } from "@/lib/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  callerRole: string;
}

const ROLES_BY_CALLER: Record<string, string[]> = {
  super_admin: ["admin", "bureau", "ouvrier"],
  admin: ["bureau", "ouvrier"],
};

export default function CreateUserDialog({ open, onOpenChange, onCreated, callerRole }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("ouvrier");
  const [workerLevel, setWorkerLevel] = useState<string>("T1");
  const [loading, setLoading] = useState(false);

  const allowedRoles = ROLES_BY_CALLER[callerRole] || [];

  const handleCreate = async () => {
    if (!email || !password || !fullName || !role) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            role,
            ...(role === "ouvrier" ? { worker_level: workerLevel } : {}),
          }),
        }
      );
      const result = await resp.json();
      if (!resp.ok || result.error) {
        throw new Error(result.error || "Erreur lors de la création");
      }
      toast.success("Utilisateur créé avec succès");
      setEmail(""); setPassword(""); setFullName(""); setRole("ouvrier"); setWorkerLevel("T1");
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
          {role === "ouvrier" && (
            <div className="space-y-2">
              <Label>Niveau ouvrier</Label>
              <Select value={workerLevel} onValueChange={setWorkerLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORKER_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>{WORKER_LEVEL_LABELS[lvl]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
