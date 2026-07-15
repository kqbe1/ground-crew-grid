import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MailCheck, MailX } from "lucide-react";

type State = "loading" | "valid" | "invalid" | "already" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await res.json();
        if (data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    setSubmitting(false);
    if (error) return setState("error");
    if ((data as any)?.success) setState("success");
    else setState("already");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {state === "loading" && (
            <>
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">Vérification…</p>
            </>
          )}
          {state === "valid" && (
            <>
              <MailX className="w-12 h-12 mx-auto text-primary" />
              <h1 className="text-xl font-bold">Se désinscrire</h1>
              <p className="text-muted-foreground">
                Confirmez pour ne plus recevoir d'emails de notre part.
              </p>
              <Button onClick={confirm} disabled={submitting} className="w-full">
                {submitting ? "Traitement…" : "Confirmer la désinscription"}
              </Button>
            </>
          )}
          {state === "success" && (
            <>
              <MailCheck className="w-12 h-12 mx-auto text-[hsl(var(--color-termine))]" />
              <h1 className="text-xl font-bold">Désinscription confirmée</h1>
              <p className="text-muted-foreground">Vous ne recevrez plus d'emails.</p>
            </>
          )}
          {state === "already" && (
            <>
              <MailCheck className="w-12 h-12 mx-auto text-muted-foreground" />
              <h1 className="text-xl font-bold">Déjà désinscrit</h1>
              <p className="text-muted-foreground">Cette adresse est déjà retirée de nos envois.</p>
            </>
          )}
          {(state === "invalid" || state === "error") && (
            <>
              <MailX className="w-12 h-12 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Lien invalide</h1>
              <p className="text-muted-foreground">
                Ce lien de désinscription n'est pas valide ou a expiré.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}