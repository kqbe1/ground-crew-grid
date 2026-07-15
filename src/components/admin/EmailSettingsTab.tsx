import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Mail } from "lucide-react";
import { z } from "zod";

type TemplateKey = "fiche-intervention" | "rappel-entretien";

interface Settings {
  subject: string;
  intro_text: string;
  footer_text: string;
  contact_phone: string;
  contact_email: string;
}

const DEFAULTS: Record<TemplateKey, Settings> = {
  "fiche-intervention": {
    subject: "Votre fiche d'intervention AG Chauffage",
    intro_text:
      "Suite à notre intervention, veuillez trouver ci-dessous le récapitulatif ainsi que la fiche d'intervention en pièce jointe (lien PDF).",
    footer_text: "Merci de votre confiance,\nAG Chauffage",
    contact_phone: "",
    contact_email: "info@agchauffage.be",
  },
  "rappel-entretien": {
    subject: "Votre entretien AG Chauffage — planifions un rendez-vous",
    intro_text:
      "Nous vous contactons pour convenir d'une date pour votre prochain entretien. Merci de nous répondre à cet email ou de nous téléphoner afin de fixer un rendez-vous.",
    footer_text: "Merci de votre confiance,\nAG Chauffage",
    contact_phone: "",
    contact_email: "info@agchauffage.be",
  },
};

const schema = z.object({
  subject: z.string().trim().min(3, "L'objet est requis (3 caractères min.)").max(200, "200 caractères max."),
  intro_text: z.string().trim().min(10, "Le texte d'introduction est requis (10 caractères min.)").max(2000, "2000 caractères max."),
  footer_text: z.string().trim().max(500, "500 caractères max.").optional().default(""),
  contact_phone: z.string().trim().max(50).optional().default(""),
  contact_email: z.string().trim().max(255).email("Email invalide").or(z.literal("")).optional().default(""),
});

function TemplateEditor({ templateKey }: { templateKey: TemplateKey }) {
  const [values, setValues] = useState<Settings>(DEFAULTS[templateKey]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isRappel = templateKey === "rappel-entretien";

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("email_settings")
        .select("subject, intro_text, footer_text, contact_phone, contact_email")
        .eq("template_key", templateKey)
        .maybeSingle();
      if (data) setValues(data as Settings);
      else setValues(DEFAULTS[templateKey]);
      setLoading(false);
    })();
  }, [templateKey]);

  const save = async () => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Champs invalides");
      return;
    }
    if (isRappel && !parsed.data.contact_email) {
      toast.error("L'email de contact est requis pour ce modèle");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("email_settings")
      .upsert(
        {
          template_key: templateKey,
          subject: parsed.data.subject,
          intro_text: parsed.data.intro_text,
          footer_text: parsed.data.footer_text || DEFAULTS[templateKey].footer_text,
          contact_phone: parsed.data.contact_phone || "",
          contact_email: parsed.data.contact_email || "info@agchauffage.be",
        },
        { onConflict: "company_id,template_key" },
      );
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Erreur lors de la sauvegarde");
      return;
    }
    toast.success("Modèle enregistré");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="subject">
          Objet de l'email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="subject"
          value={values.subject}
          maxLength={200}
          onChange={(e) => setValues({ ...values, subject: e.target.value })}
          placeholder={DEFAULTS[templateKey].subject}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="intro">
          Texte d'introduction <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="intro"
          rows={5}
          maxLength={2000}
          value={values.intro_text}
          onChange={(e) => setValues({ ...values, intro_text: e.target.value })}
          placeholder={DEFAULTS[templateKey].intro_text}
        />
        <p className="text-xs text-muted-foreground">
          Ce texte apparaît juste après « Bonjour [nom du client] ».
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="footer">Signature de fin</Label>
        <Textarea
          id="footer"
          rows={3}
          maxLength={500}
          value={values.footer_text}
          onChange={(e) => setValues({ ...values, footer_text: e.target.value })}
          placeholder={DEFAULTS[templateKey].footer_text}
        />
      </div>

      {isRappel && (
        <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact_phone">Téléphone de contact</Label>
            <Input
              id="contact_phone"
              value={values.contact_phone}
              maxLength={50}
              onChange={(e) => setValues({ ...values, contact_phone: e.target.value })}
              placeholder="+32 4 000 00 00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_email">
              Email de contact <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact_email"
              type="email"
              value={values.contact_email}
              maxLength={255}
              onChange={(e) => setValues({ ...values, contact_email: e.target.value })}
              placeholder="info@agchauffage.be"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

export default function EmailSettingsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4" /> Modèles d'emails envoyés aux clients
        </CardTitle>
        <CardDescription>
          Personnalisez le contenu des emails envoyés depuis <strong>info@agchauffage.be</strong> vers vos clients.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="fiche-intervention">
          <TabsList>
            <TabsTrigger value="fiche-intervention">Fiche d'intervention</TabsTrigger>
            <TabsTrigger value="rappel-entretien">Rappel d'entretien</TabsTrigger>
          </TabsList>
          <TabsContent value="fiche-intervention" className="mt-4">
            <TemplateEditor templateKey="fiche-intervention" />
          </TabsContent>
          <TabsContent value="rappel-entretien" className="mt-4">
            <TemplateEditor templateKey="rappel-entretien" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}