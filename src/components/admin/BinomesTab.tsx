import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BINOME_LEVELS } from "@/lib/constants";
import { toast } from "sonner";

type Binome = {
  id: string;
  code: string;
  kind: string;
  name: string;
  is_active: boolean;
};

const KIND_LABELS: Record<string, string> = {
  stagiaire: "Stagiaire",
  apprenti: "Apprenti",
  autre: "Autre",
};

export default function BinomesTab() {
  const [items, setItems] = useState<Binome[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Binome | null>(null);
  const [code, setCode] = useState("B0");
  const [kind, setKind] = useState("stagiaire");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("task_binomes")
      .select("id, code, kind, name, is_active")
      .order("code");
    setItems((data as Binome[]) ?? []);
  };

  useEffect(() => { fetchItems(); }, []);

  const openNew = () => {
    const used = new Set(items.map((i) => i.code));
    const next = BINOME_LEVELS.find((c) => !used.has(c)) ?? "B0";
    setEdit(null);
    setCode(next);
    setKind("stagiaire");
    setName("");
    setIsActive(true);
    setOpen(true);
  };

  const openEdit = (b: Binome) => {
    setEdit(b);
    setCode(b.code);
    setKind(b.kind);
    setName(b.name);
    setIsActive(b.is_active);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Le nom est obligatoire"); return; }
    setSaving(true);
    if (edit) {
      const { error } = await supabase
        .from("task_binomes")
        .update({ code, kind, name: name.trim(), is_active: isActive })
        .eq("id", edit.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Binôme mis à jour");
    } else {
      const { error } = await supabase
        .from("task_binomes")
        .insert({ code, kind, name: name.trim(), is_active: isActive } as any);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Binôme créé");
    }
    setSaving(false);
    setOpen(false);
    fetchItems();
  };

  const remove = async (b: Binome) => {
    if (!confirm(`Supprimer le binôme ${b.code} — ${b.name} ?`)) return;
    const { error } = await supabase.from("task_binomes").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Binôme supprimé");
    fetchItems();
  };

  const usedCodes = new Set(items.filter((i) => i.id !== edit?.id).map((i) => i.code));
  const activeCount = items.filter((i) => i.is_active).length;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Binômes</CardTitle>
            <p className="text-sm text-muted-foreground">{activeCount} actif(s) sur {items.length} — max 20 actifs</p>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1.5" disabled={activeCount >= 20 && items.length >= 21}>
            <Plus className="w-4 h-4" /> Nouveau binôme
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((b) => (
            <div key={b.id} className={`flex items-center gap-3 p-3 rounded-lg border ${!b.is_active ? "opacity-50" : ""}`}>
              <div className="font-mono font-semibold w-12">{b.code}</div>
              <div className="flex-1">
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-muted-foreground">{KIND_LABELS[b.kind] || b.kind}</div>
              </div>
              <Switch
                checked={b.is_active}
                onCheckedChange={async (v) => {
                  const { error } = await supabase.from("task_binomes").update({ is_active: v }).eq("id", b.id);
                  if (error) { toast.error(error.message); return; }
                  fetchItems();
                }}
              />
              <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(b)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center text-muted-foreground py-6">Aucun binôme configuré</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit ? "Modifier le binôme" : "Nouveau binôme"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code</Label>
                <Select value={code} onValueChange={setCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BINOME_LEVELS.map((c) => (
                      <SelectItem key={c} value={c} disabled={usedCodes.has(c)}>
                        {c}{usedCodes.has(c) ? " (utilisé)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stagiaire">Stagiaire</SelectItem>
                    <SelectItem value="apprenti">Apprenti</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="!m-0">Actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}