import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Save, Settings } from "lucide-react";

interface PlatformSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  updated_at: string;
}

export default function SuperAdminSettings() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["sa-platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as PlatformSetting[];
    },
  });

  useEffect(() => {
    const vals: Record<string, string> = {};
    settings.forEach((s) => {
      vals[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value);
    });
    setEditValues(vals);
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      let parsed: any;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: parsed })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-platform-settings"] });
      toast.success("Paramètre mis à jour");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const settingLabels: Record<string, string> = {
    default_max_users: "Utilisateurs max par défaut",
    default_plan: "Plan par défaut",
    maintenance_mode: "Mode maintenance",
    allowed_plans: "Plans disponibles",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Paramètres de la plateforme</h1>
          <p className="text-muted-foreground">Configuration globale du SaaS</p>
        </div>
      </div>

      <div className="grid gap-4">
        {settings.map((setting) => (
          <Card key={setting.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-semibold">
                    {settingLabels[setting.key] || setting.key}
                  </Label>
                  {setting.description && (
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  )}
                  <code className="text-[10px] text-muted-foreground/60">{setting.key}</code>
                </div>
                <div className="flex items-center gap-2 min-w-[250px]">
                  {setting.key === "maintenance_mode" ? (
                    <Switch
                      checked={editValues[setting.key] === "true"}
                      onCheckedChange={(v) => {
                        setEditValues({ ...editValues, [setting.key]: String(v) });
                        updateMutation.mutate({ key: setting.key, value: String(v) });
                      }}
                    />
                  ) : (
                    <>
                      <Input
                        value={editValues[setting.key] || ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, [setting.key]: e.target.value })
                        }
                        className="text-sm"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          updateMutation.mutate({
                            key: setting.key,
                            value: editValues[setting.key],
                          })
                        }
                        disabled={updateMutation.isPending}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
