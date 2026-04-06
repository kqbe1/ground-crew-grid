import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Upload, Image } from "lucide-react";

interface PdfSettings {
  id: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_vat: string;
  logo_url: string | null;
  document_title: string;
  primary_color: string;
  show_horaires: boolean;
  show_description: boolean;
  show_checklist: boolean;
  show_client_state: boolean;
  show_photos_before: boolean;
  show_photos_after: boolean;
  show_signature: boolean;
  show_worker_info: boolean;
  show_client_info: boolean;
  show_intervention_type: boolean;
  footer_text: string;
}

const sectionToggles: { key: keyof PdfSettings; label: string }[] = [
  { key: "show_client_info", label: "Informations client" },
  { key: "show_worker_info", label: "Informations ouvrier" },
  { key: "show_intervention_type", label: "Type d'intervention" },
  { key: "show_horaires", label: "Horaires (arrivée / départ)" },
  { key: "show_description", label: "Description de l'intervention" },
  { key: "show_checklist", label: "Checklist / points de contrôle" },
  { key: "show_client_state", label: "État du client (présent/absent)" },
  { key: "show_photos_before", label: "Photos avant intervention" },
  { key: "show_photos_after", label: "Photos après intervention" },
  { key: "show_signature", label: "Signature client" },
];

export default function PdfSettingsTab() {
  const [settings, setSettings] = useState<PdfSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("pdf_settings")
        .select("*")
        .limit(1)
        .single();
      if (data) setSettings(data as unknown as PdfSettings);
      setLoading(false);
    };
    fetch();
  }, []);

  const update = (key: keyof PdfSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `company-logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("intervention-photos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("intervention-photos")
        .getPublicUrl(path);

      // Store the path for signed URL generation
      update("logo_url", path);
      toast.success("Logo uploadé");
    } catch (err: any) {
      toast.error("Erreur upload : " + err.message);
    }
    setUploading(false);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...rest } = settings;
    const { error } = await supabase
      .from("pdf_settings")
      .update(rest as any)
      .eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success("Configuration PDF sauvegardée");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!settings) {
    return <div className="text-center text-muted-foreground py-8">Configuration introuvable</div>;
  }

  return (
    <div className="space-y-6">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="w-4 h-4" />
            Entreprise & Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom de l'entreprise</Label>
              <Input
                value={settings.company_name}
                onChange={(e) => update("company_name", e.target.value)}
                placeholder="Mon Entreprise SPRL"
              />
            </div>
            <div className="space-y-2">
              <Label>N° TVA</Label>
              <Input
                value={settings.company_vat}
                onChange={(e) => update("company_vat", e.target.value)}
                placeholder="BE0123.456.789"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adresse</Label>
            <Textarea
              value={settings.company_address}
              onChange={(e) => update("company_address", e.target.value)}
              placeholder="Rue de l'Industrie 10, 1000 Bruxelles"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                value={settings.company_phone}
                onChange={(e) => update("company_phone", e.target.value)}
                placeholder="+32 2 123 45 67"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={settings.company_email}
                onChange={(e) => update("company_email", e.target.value)}
                placeholder="info@entreprise.be"
              />
            </div>
            <div className="space-y-2">
              <Label>Site web</Label>
              <Input
                value={settings.company_website}
                onChange={(e) => update("company_website", e.target.value)}
                placeholder="www.entreprise.be"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Logo de l'entreprise</Label>
            <div className="flex items-center gap-4">
              {settings.logo_url && (
                <div className="w-20 h-20 border rounded flex items-center justify-center bg-muted overflow-hidden">
                  <img
                    src={settings.logo_url}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <div>
                <label htmlFor="logo-upload">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? "Upload..." : "Charger un logo"}
                    </span>
                  </Button>
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <p className="text-xs text-muted-foreground mt-1">PNG ou JPG, max 500x500px recommandé</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paramètres du document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Titre du document</Label>
              <Input
                value={settings.document_title}
                onChange={(e) => update("document_title", e.target.value)}
                placeholder="Fiche d'intervention"
              />
            </div>
            <div className="space-y-2">
              <Label>Couleur principale</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => update("primary_color", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => update("primary_color", e.target.value)}
                  className="w-[120px]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Texte de pied de page</Label>
            <Input
              value={settings.footer_text}
              onChange={(e) => update("footer_text", e.target.value)}
              placeholder="Merci pour votre confiance — www.entreprise.be"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sections Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sections affichées dans le PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sectionToggles.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={settings[key] as boolean}
                  onCheckedChange={(v) => update(key, !!v)}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Sauvegarde..." : "Sauvegarder la configuration"}
        </Button>
      </div>
    </div>
  );
}
