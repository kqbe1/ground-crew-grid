import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateEditBinomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binome?: any;
  workers: any[];
  onSaved: () => void;
}

export default function CreateEditBinomeDialog({ open, onOpenChange, binome, workers, onSaved }: CreateEditBinomeDialogProps) {
  const [name, setName] = useState("");
  const [user1, setUser1] = useState("");
  const [user2, setUser2] = useState("");
  const [pct1, setPct1] = useState(50);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (binome) {
      setName(binome.name);
      setUser1(binome.user1_id);
      setUser2(binome.user2_id);
      setPct1(binome.user1_percentage);
    } else {
      setName("");
      setUser1("");
      setUser2("");
      setPct1(50);
    }
  }, [binome, open]);

  const handleSave = async () => {
    if (!name || !user1 || !user2) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    if (user1 === user2) {
      toast.error("Les deux ouvriers doivent être différents");
      return;
    }
    setSaving(true);
    const payload = {
      name,
      user1_id: user1,
      user2_id: user2,
      user1_percentage: pct1,
      user2_percentage: 100 - pct1,
    };

    const { error } = binome
      ? await supabase.from("binomes").update(payload).eq("id", binome.id)
      : await supabase.from("binomes").insert(payload);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(binome ? "Binôme modifié" : "Binôme créé");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{binome ? "Modifier le binôme" : "Nouveau binôme"}</DialogTitle>
          <DialogDescription>Configurez les membres et la répartition du travail</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nom du binôme</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Équipe A" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ouvrier 1</Label>
              <Select value={user1} onValueChange={setUser1}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ouvrier 2</Label>
              <Select value={user2} onValueChange={setUser2}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Répartition : {pct1}% / {100 - pct1}%</Label>
            <Slider value={[pct1]} onValueChange={(v) => setPct1(v[0])} min={10} max={90} step={5} className="mt-2" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : binome ? "Modifier" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
