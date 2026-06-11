import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Upload, Image, Download, Plus, Trash2, GripVertical } from "lucide-react";
import { generateFichePdf, PdfConfig } from "@/lib/generateFichePdf";
import { generateDevisPdf } from "@/lib/generateDevisPdf";

type DocumentType = "fiche_intervention" | "fiche_entretien" | "devis";

interface TextBlock {
  id: string;
  title?: string;
  content: string;
  position: "top" | "bottom";
}

interface PdfSettings {
  id: string;
  document_type: DocumentType;
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
  text_blocks: TextBlock[];
}

const SECTION_TOGGLES: Record<DocumentType, { key: keyof PdfSettings; label: string }[]> = {
  fiche_intervention: [
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
  ],
  fiche_entretien: [
    { key: "show_client_info", label: "Informations client" },
    { key: "show_worker_info", label: "Informations technicien" },
    { key: "show_intervention_type", label: "Type d'entretien" },
    { key: "show_horaires", label: "Horaires (arrivée / départ)" },
    { key: "show_description", label: "Description du travail" },
    { key: "show_checklist", label: "Checklist d'entretien" },
    { key: "show_client_state", label: "Présence client" },
    { key: "show_photos_before", label: "Photos avant entretien" },
    { key: "show_photos_after", label: "Photos après entretien" },
    { key: "show_signature", label: "Signature client" },
  ],
  devis: [
    { key: "show_client_info", label: "Coordonnées client" },
    { key: "show_worker_info", label: "Créé par (technicien)" },
  ],
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  fiche_intervention: "Fiche d'intervention",
  fiche_entretien: "Fiche d'entretien",
  devis: "Devis",
};

const DOC_TYPES: DocumentType[] = ["fiche_intervention", "fiche_entretien", "devis"];

function newBlockId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeBlocks(raw: unknown): TextBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b: any) => ({
      id: typeof b?.id === "string" && b.id ? b.id : newBlockId(),
      title: typeof b?.title === "string" ? b.title : "",
      content: typeof b?.content === "string" ? b.content : "",
      position: b?.position === "bottom" ? "bottom" : "top",
    }))
    .filter((b) => b.title || b.content);
}

export default function PdfSettingsTab() {
  const [allSettings, setAllSettings] = useState<Record<DocumentType, PdfSettings | null>>({
    fiche_intervention: null,
    fiche_entretien: null,
    devis: null,
  });
  const [activeType, setActiveType] = useState<DocumentType>("fiche_intervention");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const settings = allSettings[activeType];

  const getLogoPublicUrl = (logoPath: string) => {
    const { data } = supabase.storage.from("company-assets").getPublicUrl(logoPath);
    return data?.publicUrl || null;
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("pdf_settings").select("*");
      const map: Record<DocumentType, PdfSettings | null> = {
        fiche_intervention: null,
        fiche_entretien: null,
        devis: null,
      };
      for (const row of data ?? []) {
        const dt = (row.document_type as DocumentType) || "fiche_intervention";
        if (DOC_TYPES.includes(dt)) {
          map[dt] = {
            ...(row as any),
            text_blocks: normalizeBlocks((row as any).text_blocks),
          } as PdfSettings;
        }
      }
      setAllSettings(map);

      const firstWithLogo = (data ?? []).find((r: any) => r.logo_url);
      if (firstWithLogo?.logo_url) {
        const publicUrl = getLogoPublicUrl(firstWithLogo.logo_url as string);
          if (publicUrl) {
            try {
              const resp = await globalThis.fetch(publicUrl);
              const blob = await resp.blob();
              const reader = new FileReader();
              reader.onloadend = () => setLogoDataUrl(reader.result as string);
              reader.readAsDataURL(blob);
            } catch {}
          }
        }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const update = (key: keyof PdfSettings, value: any) => {
    if (!settings) return;
    setAllSettings((prev) => ({ ...prev, [activeType]: { ...(prev[activeType] as PdfSettings), [key]: value } }));
  };

  const updateBlocks = (next: TextBlock[]) => update("text_blocks", next);
  const addBlock = (position: "top" | "bottom") => {
    if (!settings) return;
    updateBlocks([...(settings.text_blocks || []), { id: newBlockId(), title: "", content: "", position }]);
  };
  const removeBlock = (id: string) => {
    if (!settings) return;
    updateBlocks((settings.text_blocks || []).filter((b) => b.id !== id));
  };
  const updateBlock = (id: string, patch: Partial<TextBlock>) => {
    if (!settings) return;
    updateBlocks((settings.text_blocks || []).map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;

    setUploading(true);
    try {
      // Get the current user's company_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Entreprise introuvable");

      const ext = file.name.split(".").pop();
      const path = `${profile.company_id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      update("logo_url", path);
      const reader = new FileReader();
      reader.onloadend = () => setLogoDataUrl(reader.result as string);
      reader.readAsDataURL(file);
      toast.success("Logo uploadé");
    } catch (err: any) {
      toast.error("Erreur upload : " + err.message);
    }
    setUploading(false);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, text_blocks, ...rest } = settings;
    const payload: any = { ...rest, text_blocks: text_blocks ?? [] };
    const { error } = await supabase
      .from("pdf_settings")
      .update(payload)
      .eq("id", id);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success(`Configuration « ${DOC_TYPE_LABELS[activeType]} » sauvegardée`);
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
    return (
      <Tabs value={activeType} onValueChange={(v) => setActiveType(v as DocumentType)}>
        <TabsList>
          {DOC_TYPES.map((dt) => (
            <TabsTrigger key={dt} value={dt}>{DOC_TYPE_LABELS[dt]}</TabsTrigger>
          ))}
        </TabsList>
        <div className="text-center text-muted-foreground py-8">
          Configuration introuvable pour ce document.
        </div>
      </Tabs>
    );
  }

  const sectionToggles = SECTION_TOGGLES[activeType];

  return (
    <div className="space-y-4">
      <Tabs value={activeType} onValueChange={(v) => setActiveType(v as DocumentType)}>
        <TabsList>
          {DOC_TYPES.map((dt) => (
            <TabsTrigger key={dt} value={dt}>{DOC_TYPE_LABELS[dt]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="text-sm text-muted-foreground">
        Chaque document a sa propre configuration : identité, couleurs, logo, sections et blocs de texte personnalisés.
      </p>

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
                    src={getLogoPublicUrl(settings.logo_url) || ""}
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
          {sectionToggles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune section configurable pour ce document.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {/* Text blocks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Blocs de texte personnalisés</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => addBlock("top")}>
                <Plus className="w-4 h-4 mr-1" /> Bloc haut
              </Button>
              <Button size="sm" variant="outline" onClick={() => addBlock("bottom")}>
                <Plus className="w-4 h-4 mr-1" /> Bloc bas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ajoutez vos mentions, conditions générales, remerciements, conditions de validité, etc.
            Les blocs « haut » s'affichent juste sous le titre, les blocs « bas » juste au-dessus du pied de page.
          </p>
          {(settings.text_blocks || []).length === 0 && (
            <p className="text-sm text-muted-foreground italic">Aucun bloc ajouté.</p>
          )}
          {(settings.text_blocks || []).map((block) => (
            <div key={block.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <Input
                  className="flex-1"
                  placeholder="Titre du bloc (optionnel)"
                  value={block.title ?? ""}
                  onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                />
                <Select
                  value={block.position}
                  onValueChange={(v) => updateBlock(block.id, { position: v as "top" | "bottom" })}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">En haut</SelectItem>
                    <SelectItem value="bottom">En bas</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => removeBlock(block.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                placeholder="Contenu du bloc..."
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                rows={4}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Preview + Save */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => {
            if (!settings) return;
            if (activeType === "devis") {
              const sampleQuote = {
                id: "preview-devis-0001",
                created_at: new Date().toISOString(),
                client_name: "Dupont Jean",
                client_address: "Rue de la Loi 42",
                client_postal_code: "1000",
                client_city: "Bruxelles",
                client_phone: "+32 475 12 34 56",
                client_email: "jean.dupont@email.be",
                installation_type: "chauffage_gaz",
                status: "draft",
                billing_same_as_intervention: true,
                rooms_data: [],
                checklist_data: {},
                plan_photos: [],
                photos: [],
                voice_notes: [],
              };
              const doc = generateDevisPdf(sampleQuote as any, settings as any, logoDataUrl);
              doc.save("apercu-devis.pdf");
              toast.success("PDF d'aperçu téléchargé");
              return;
            }
            const sampleSheet = {
              id: "preview-0001-abcd-efgh",
              created_at: new Date().toISOString(),
              arrival_time: new Date(Date.now() - 3600000 * 2).toISOString(),
              departure_time: new Date().toISOString(),
              description: "Remplacement du brûleur et vérification complète du circuit. Nettoyage de la chaudière et contrôle des fumées. RAS.",
              final_status: "termine",
              is_draft: false,
              client_present: true,
              client_absent: false,
              signature_data: null,
              signed_at: null,
              sent_to_client: false,
              photos_before: [],
              photos_after: [],
              entretien_type: activeType === "fiche_entretien" ? "annuel" : undefined,
              checklist_results: [
                { label: "Vérification étanchéité gaz", checked: true },
                { label: "Contrôle température fumées", checked: true },
                { label: "Nettoyage brûleur", checked: true },
                { label: "Vérification ventilation", checked: false },
                { label: "Test sécurité thermique", checked: true },
              ],
              work_tasks: {
                title: activeType === "fiche_entretien" ? "Entretien annuel chaudière gaz" : "Intervention dépannage",
                intervention_type: activeType === "fiche_entretien" ? "entretien_gaz" : "depannage",
                clients: {
                  name: "Dupont Jean",
                  email: "jean.dupont@email.be",
                  phone: "+32 475 12 34 56",
                  address_intervention: "Rue de la Loi 42, 1000 Bruxelles",
                },
              },
              profiles: { full_name: "Marc Leroy" },
            };
            const doc = generateFichePdf(sampleSheet, settings as Partial<PdfConfig>, logoDataUrl);
            doc.save(`apercu-${activeType}.pdf`);
            toast.success("PDF d'aperçu téléchargé");
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          Télécharger l'aperçu PDF
        </Button>
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Sauvegarde..." : "Sauvegarder la configuration"}
        </Button>
      </div>
    </div>
  );
}
