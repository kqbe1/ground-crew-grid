import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

import AppLayout from "@/components/layout/AppLayout";
import MobileLayout from "@/components/layout/MobileLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Planning from "@/pages/Planning";
import Clients from "@/pages/Clients";
import Entretiens from "@/pages/Entretiens";
import Commandes from "@/pages/Commandes";
import Fiches from "@/pages/Fiches";
import Admin from "@/pages/Admin";
import MobileAgenda from "@/pages/mobile/MobileAgenda";
import MobileTaskDetail from "@/pages/mobile/MobileTaskDetail";
import MobileFicheForm from "@/pages/mobile/MobileFicheForm";
import MobileFiches from "@/pages/mobile/MobileFiches";
import MobilePieces from "@/pages/mobile/MobilePieces";
import MobileProfil from "@/pages/mobile/MobileProfil";
import NotFound from "@/pages/NotFound";
import Install from "@/pages/Install";

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
