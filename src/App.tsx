import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";

import AppLayout from "@/components/layout/AppLayout";
import MobileLayout from "@/components/layout/MobileLayout";
import Auth from "@/pages/Auth";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Planning = lazy(() => import("@/pages/Planning"));
const Clients = lazy(() => import("@/pages/Clients"));
const Entretiens = lazy(() => import("@/pages/Entretiens"));
const Commandes = lazy(() => import("@/pages/Commandes"));
const Fiches = lazy(() => import("@/pages/Fiches"));
const Admin = lazy(() => import("@/pages/Admin"));
const MobileAgenda = lazy(() => import("@/pages/mobile/MobileAgenda"));
const MobileTaskDetail = lazy(() => import("@/pages/mobile/MobileTaskDetail"));
const MobileFicheForm = lazy(() => import("@/pages/mobile/MobileFicheForm"));
const MobileFiches = lazy(() => import("@/pages/mobile/MobileFiches"));
const MobilePieces = lazy(() => import("@/pages/mobile/MobilePieces"));
const MobileProfil = lazy(() => import("@/pages/mobile/MobileProfil"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Install = lazy(() => import("@/pages/Install"));

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
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />

            {/* Webapp Admin/Secrétariat */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/entretiens" element={<Entretiens />} />
              <Route path="/commandes" element={<Commandes />} />
              <Route path="/fiches" element={<Fiches />} />
              <Route path="/admin" element={<Admin />} />
            </Route>

            {/* PWA Mobile Ouvrier */}
            <Route path="/mobile" element={<MobileLayout />}>
              <Route index element={<MobileAgenda />} />
              <Route path="tache/:id" element={<MobileTaskDetail />} />
              <Route path="fiche/:taskId" element={<MobileFicheForm />} />
              <Route path="fiches" element={<MobileFiches />} />
              <Route path="pieces" element={<MobilePieces />} />
              <Route path="profil" element={<MobileProfil />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
