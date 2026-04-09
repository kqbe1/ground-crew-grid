import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INTERVENTION_TYPE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, X, GripVertical } from "lucide-react";

interface CreateEditTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any;
  onSaved: () => void;
}

export default function CreateEditTemplateDialog({ open, onOpenChange, template, onSaved }: CreateEditTemplateDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [interventionType, setInterventionType] = useState("autre");
  const [duration, setDuration] = useState(60);
  const [checklist, setChecklist] = useState<{ label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setInterventionType(template.intervention_type);
      setDuration(template.default_duration_minutes);
      setChecklist(Array.isArray(template.checklist) ? template.checklist : []);
    } else {
      setName("");
      setDescription("");
      setInterventionType("autre");
      setDuration(60);
      setChecklist([]);
    }
  }, [template, open]);

  const addChecklistItem = () => setChecklist([...checklist, { label: "" }]);
  const removeChecklistItem = (i: number) => setChecklist(checklist.filter((_, idx) => idx !== i));
  const updateChecklistItem = (i: number, label: string) => {
    const copy = [...checklist];
    copy[i] = { label };
    setChecklist(copy);
  };

  const handleSave = async () => {
    if (!name) { toast.error("Nom requis"); return; }
    setSaving(true);

    const validChecklist = checklist.filter((c) => c.label.trim());
    const payload = {
      name,
      description: description || null,
      intervention_type: interventionType as any,
      default_duration_minutes: duration,
      checklist: validChecklist as any,
      created_by: template?.created_by || user?.id,
    };

    const { error } = template
      ? await supabase.from("task_templates").update(payload).eq("id", template.id)
      : await supabase.from("task_templates").insert(payload as any);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(template ? "Template modifié" : "Template créé");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Modifier le template" : "Nouveau template"}</DialogTitle>
          <DialogDescription>Configurez le modèle de fiche d'intervention</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Entretien chaudière gaz" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description optionnelle..." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type d'intervention</Label>
              <Select value={interventionType} onValueChange={setInterventionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INTERVENTION_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Durée par défaut (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={15} step={15} />
            </div>
          </div>

          {/* Checklist builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Checklist</Label>
              <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
                <Plus className="w-3 h-3 mr-1" /> Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    value={item.label}
                    onChange={(e) => updateChecklistItem(i, e.target.value)}
                    placeholder={`Point de contrôle ${i + 1}`}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeChecklistItem(i)} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {checklist.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Aucun point de contrôle</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : template ? "Modifier" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
