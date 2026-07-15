import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";

import AppLayout from "@/components/layout/AppLayout";
import MobileLayout from "@/components/layout/MobileLayout";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import Auth from "@/pages/Auth";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Planning = lazy(() => import("@/pages/Planning"));
const Clients = lazy(() => import("@/pages/Clients"));
const Entretiens = lazy(() => import("@/pages/Entretiens"));
const Commandes = lazy(() => import("@/pages/Commandes"));
const Fiches = lazy(() => import("@/pages/Fiches"));
const Admin = lazy(() => import("@/pages/Admin"));
const TempsOuvriers = lazy(() => import("@/pages/TempsOuvriers"));
const Devis = lazy(() => import("@/pages/Devis"));
const Taches = lazy(() => import("@/pages/Taches"));
const Dossiers = lazy(() => import("@/pages/Dossiers"));
const DossierDetail = lazy(() => import("@/pages/DossierDetail"));
const TacheDetail = lazy(() => import("@/pages/TacheDetail"));
const FicheDetail = lazy(() => import("@/pages/FicheDetail"));
const DevisDetail = lazy(() => import("@/pages/DevisDetail"));
const CommandeDetail = lazy(() => import("@/pages/CommandeDetail"));
const ClientDetail = lazy(() => import("@/pages/ClientDetail"));
const EntretienDetail = lazy(() => import("@/pages/EntretienDetail"));
const MobileAgenda = lazy(() => import("@/pages/mobile/MobileAgenda"));
const MobileTaskDetail = lazy(() => import("@/pages/mobile/MobileTaskDetail"));
const MobileFicheRouter = lazy(() => import("@/pages/mobile/MobileFicheRouter"));
const MobileFiches = lazy(() => import("@/pages/mobile/MobileFiches"));
const MobilePieces = lazy(() => import("@/pages/mobile/MobilePieces"));
const MobileProfil = lazy(() => import("@/pages/mobile/MobileProfil"));
const MobileDevisForm = lazy(() => import("@/pages/mobile/MobileDevisForm"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Install = lazy(() => import("@/pages/Install"));
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));

// SuperAdmin pages
const SuperAdminDashboard = lazy(() => import("@/pages/super-admin/SuperAdminDashboard"));
const SuperAdminCompanies = lazy(() => import("@/pages/super-admin/SuperAdminCompanies"));
const SuperAdminUsers = lazy(() => import("@/pages/super-admin/SuperAdminUsers"));
const SuperAdminSettings = lazy(() => import("@/pages/super-admin/SuperAdminSettings"));
const SuperAdminLogs = lazy(() => import("@/pages/super-admin/SuperAdminLogs"));

const PageLoader = () => (
  <div className="flex items-center justify-center h-32">
    <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/install" element={<Install />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />

              {/* SuperAdmin */}
              <Route path="/super-admin" element={<SuperAdminLayout />}>
                <Route index element={<SuperAdminDashboard />} />
                <Route path="companies" element={<SuperAdminCompanies />} />
                <Route path="users" element={<SuperAdminUsers />} />
                <Route path="settings" element={<SuperAdminSettings />} />
                <Route path="logs" element={<SuperAdminLogs />} />
              </Route>

              {/* Webapp Admin/Secrétariat */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/planning" element={<Planning />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/entretiens" element={<Entretiens />} />
                <Route path="/commandes" element={<Commandes />} />
                <Route path="/fiches" element={<Fiches />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/temps-ouvriers" element={<TempsOuvriers />} />
                <Route path="/taches" element={<Taches />} />
                <Route path="/taches/:id" element={<TacheDetail />} />
                <Route path="/devis" element={<Devis />} />
                <Route path="/devis/nouveau" element={<MobileDevisForm />} />
                <Route path="/dossiers" element={<Dossiers />} />
                <Route path="/dossiers/:id" element={<DossierDetail />} />
                <Route path="/fiches/:id" element={<FicheDetail />} />
                <Route path="/devis/:id" element={<DevisDetail />} />
                <Route path="/commandes/:id" element={<CommandeDetail />} />
                <Route path="/clients/:id" element={<ClientDetail />} />
                <Route path="/entretiens/:id" element={<EntretienDetail />} />
              </Route>

              {/* PWA Mobile Ouvrier */}
              <Route path="/mobile" element={<MobileLayout />}>
                <Route index element={<MobileAgenda />} />
                <Route path="tache/:id" element={<MobileTaskDetail />} />
                <Route path="fiche/:taskId" element={<MobileFicheRouter />} />
                <Route path="fiches" element={<MobileFiches />} />
                <Route path="fiches/:id" element={<FicheDetail />} />
                <Route path="pieces" element={<MobilePieces />} />
                <Route path="profil" element={<MobileProfil />} />
                <Route path="devis/nouveau" element={<MobileDevisForm />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
