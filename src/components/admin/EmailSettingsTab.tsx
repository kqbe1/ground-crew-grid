import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Mail, FileText, CalendarClock } from "lucide-react";
import { z } from "zod";

type TemplateKey = "fiche-intervention" | "rappel-entretien";

interface Settings {
  subject: string;
  intro_text: string;
  footer_text: string;
  contact_phone: string;
  contact_email: string;
  auto_reminder_enabled?: boolean;
  reminder_days_before?: number;
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
    auto_reminder_enabled: true,
    reminder_days_before: 30,
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

  const description = isRappel
    ? "Email automatique proposé au client pour convenir d'une date pour son prochain entretien (envoyé avant l'échéance)."
    : "Email envoyé manuellement au client avec le récapitulatif et le PDF de la fiche d'intervention.";

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("email_settings")
        .select("subject, intro_text, footer_text, contact_phone, contact_email, auto_reminder_enabled, reminder_days_before")
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
          ...(isRappel
            ? {
                auto_reminder_enabled: values.auto_reminder_enabled ?? true,
                reminder_days_before: values.reminder_days_before ?? 30,
              }
            : {}),
        } as any,
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
      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground flex gap-2">
        {isRappel ? <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" /> : <FileText className="w-4 h-4 mt-0.5 shrink-0" />}
        <span>{description}</span>
      </div>
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

      {isRappel && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="auto_reminder">Envoi automatique aux clients</Label>
              <p className="text-xs text-muted-foreground">
                Un email est envoyé automatiquement si le client a une adresse email. Sinon, seule
                l'alerte « Attention ce mois-ci » apparaît dans l'app.
              </p>
            </div>
            <Switch
              id="auto_reminder"
              checked={values.auto_reminder_enabled ?? true}
              onCheckedChange={(v) => setValues({ ...values, auto_reminder_enabled: v })}
            />
          </div>
          <div className="space-y-1.5 max-w-[220px]">
            <Label htmlFor="days_before">Envoyer combien de jours avant l'échéance ?</Label>
            <Input
              id="days_before"
              type="number"
              min={1}
              max={365}
              value={values.reminder_days_before ?? 30}
              onChange={(e) =>
                setValues({ ...values, reminder_days_before: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })
              }
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

function SenderSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [sender, setSender] = useState({
    sender_name: "",
    sender_email: "",
    reply_to_email: "",
    is_active: true,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return setLoading(false);
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", uid)
        .maybeSingle();
      const cid = profile?.company_id ?? null;
      setCompanyId(cid);
      if (cid) {
        const { data } = await supabase
          .from("company_email_settings")
          .select("sender_name, sender_email, reply_to_email, is_active")
          .eq("company_id", cid)
          .maybeSingle();
        if (data) {
          setSender({
            sender_name: data.sender_name ?? "",
            sender_email: data.sender_email ?? "",
            reply_to_email: data.reply_to_email ?? "",
            is_active: data.is_active ?? true,
          });
        }
      }
      setLoading(false);
    })();
  }, []);

  const saveSender = async () => {
    if (!companyId) return;
    const emailSchema = z.string().trim().email("Email invalide");
    if (!emailSchema.safeParse(sender.sender_email).success) {
      toast.error("Adresse d'expédition invalide");
      return;
    }
    if (sender.reply_to_email && !emailSchema.safeParse(sender.reply_to_email).success) {
      toast.error("Adresse de réponse invalide");
      return;
    }
    if (!sender.sender_name.trim()) {
      toast.error("Le nom de l'expéditeur est requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("company_email_settings").upsert(
      {
        company_id: companyId,
        sender_name: sender.sender_name.trim(),
        sender_email: sender.sender_email.trim(),
        reply_to_email: sender.reply_to_email.trim() || null,
        is_active: sender.is_active,
      },
      { onConflict: "company_id" },
    );
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Erreur lors de la sauvegarde");
      return;
    }
    toast.success("Configuration d'envoi enregistrée");
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4" /> Adresse d'envoi de l'entreprise
        </CardTitle>
        <CardDescription>
          Expéditeur utilisé pour tous les emails envoyés aux clients. Les réponses des clients
          arrivent sur l'adresse de réponse indiquée. Le domaine de l'adresse d'expédition doit être
          vérifié chez votre fournisseur d'envoi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sender_name">Nom de l'expéditeur</Label>
                <Input
                  id="sender_name"
                  value={sender.sender_name}
                  maxLength={100}
                  onChange={(e) => setSender({ ...sender, sender_name: e.target.value })}
                  placeholder="AG Chauffage"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sender_email">Adresse d'expédition</Label>
                <Input
                  id="sender_email"
                  type="email"
                  value={sender.sender_email}
                  maxLength={255}
                  onChange={(e) => setSender({ ...sender, sender_email: e.target.value })}
                  placeholder="noreply@votredomaine.be"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reply_to_email">Adresse de réponse</Label>
                <Input
                  id="reply_to_email"
                  type="email"
                  value={sender.reply_to_email}
                  maxLength={255}
                  onChange={(e) => setSender({ ...sender, reply_to_email: e.target.value })}
                  placeholder="info@votredomaine.be"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <Label htmlFor="sender_active">Envoi activé</Label>
                <p className="text-xs text-muted-foreground">
                  Si désactivé, aucun email ne part avec cette configuration.
                </p>
              </div>
              <Switch
                id="sender_active"
                checked={sender.is_active}
                onCheckedChange={(v) => setSender({ ...sender, is_active: v })}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveSender} disabled={saving || !companyId}>
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EmailSettingsTab() {
  return (
    <>
    <SenderSettingsCard />
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
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="fiche-intervention" className="gap-1.5 py-2">
              <FileText className="w-4 h-4" /> Fiche d'intervention
            </TabsTrigger>
            <TabsTrigger value="rappel-entretien" className="gap-1.5 py-2">
              <CalendarClock className="w-4 h-4" /> Rappel d'entretien (automatique)
            </TabsTrigger>
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
    </>
  );
}