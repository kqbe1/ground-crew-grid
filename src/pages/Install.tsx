import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, CheckCircle, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-sm w-full">
        <CardContent className="pt-6 text-center space-y-6">
          <img src="/pwa-icon-192.png" alt="PME Terrain" className="w-20 h-20 mx-auto rounded-2xl shadow-lg" />
          <div>
            <h1 className="text-2xl font-bold">PME Terrain</h1>
            <p className="text-muted-foreground mt-1">Installez l'app sur votre écran d'accueil</p>
          </div>

          {installed ? (
            <div className="flex items-center gap-2 justify-center text-[hsl(var(--color-termine))]">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Application installée !</span>
            </div>
          ) : deferredPrompt ? (
            <Button onClick={handleInstall} size="lg" className="w-full">
              <Download className="w-5 h-5 mr-2" />
              Installer l'application
            </Button>
          ) : isIOS ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <Smartphone className="w-8 h-8 mx-auto opacity-50" />
              <p>
                Sur iPhone/iPad, appuyez sur{" "}
                <strong>Partager</strong> (icône ↑) puis{" "}
                <strong>"Sur l'écran d'accueil"</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <Smartphone className="w-8 h-8 mx-auto opacity-50" />
              <p>
                Ouvrez le menu de votre navigateur puis sélectionnez{" "}
                <strong>"Installer l'application"</strong> ou{" "}
                <strong>"Ajouter à l'écran d'accueil"</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
