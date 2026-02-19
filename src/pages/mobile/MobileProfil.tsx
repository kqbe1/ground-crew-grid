import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WORKER_LEVEL_LABELS } from "@/lib/constants";
import { LogOut, User } from "lucide-react";

export default function MobileProfil() {
  const { profile, role, signOut, user } = useAuth();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Mon profil</h1>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold">{profile?.full_name}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <div className="flex gap-2">
            {role && <Badge>{role}</Badge>}
            {profile?.worker_level && (
              <Badge variant="outline">{WORKER_LEVEL_LABELS[profile.worker_level] || profile.worker_level}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={signOut}>
        <LogOut className="w-4 h-4 mr-2" /> Déconnexion
      </Button>
    </div>
  );
}
