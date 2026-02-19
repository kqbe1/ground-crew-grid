import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppSidebar from "./AppSidebar";

export default function AppLayout() {
  const { session, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // Ouvrier goes to mobile PWA
  if (role === "ouvrier") return <Navigate to="/mobile" replace />;

  // No role assigned yet
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-3 max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent text-accent-foreground mb-2">
            <span className="text-2xl">⏳</span>
          </div>
          <h2 className="text-xl font-bold">En attente d'attribution</h2>
          <p className="text-muted-foreground">
            Votre compte a été créé mais aucun rôle ne vous a encore été attribué. 
            Contactez votre administrateur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
