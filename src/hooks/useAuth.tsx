import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { purgeAllDrafts, pruneStaleFicheDrafts } from "@/lib/draftStorage";

type AppRole = "admin" | "bureau" | "ouvrier" | "super_admin";

interface ProfileData {
  full_name: string;
  worker_level: string | null;
  company_id: string | null;
  can_create_devis: boolean;
}

interface CompanyData {
  logo_url: string | null;
  display_name: string | null;
  name: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: ProfileData | null;
  company: CompanyData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const extractSessionCompanyId = (session: Session | null): string | null => {
  const rawCompanyId = session?.user?.user_metadata?.company_id;
  return typeof rawCompanyId === "string" && rawCompanyId.length > 0 ? rawCompanyId : null;
};

const PROFILE_FETCH_RETRIES = 3;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const syncRequestRef = useRef(0);

  const resetAuthState = () => {
    setRole(null);
    setProfile(null);
    setCompany(null);
  };

  const applySessionFallback = (session: Session | null) => {
    const sessionCompanyId = extractSessionCompanyId(session);

    // Never trust user_metadata for role — only the DB profile decides privileges.
    setRole(null);
    setProfile((current) => ({
      full_name:
        current?.full_name ||
        session?.user?.user_metadata?.full_name ||
        session?.user?.email ||
        "",
      worker_level: current?.worker_level ?? null,
      company_id: current?.company_id ?? sessionCompanyId,
      can_create_devis: current?.can_create_devis ?? false,
    }));
  };

  const fetchUserData = useCallback(async (session: Session) => {
    applySessionFallback(session);
    setCompany(null);

    let data: {
      full_name: string;
      worker_level: string | null;
      role: AppRole | null;
      company_id: string | null;
      is_active: boolean;
      can_create_devis: boolean;
    } | null = null;
    let error: Error | null = null;

    for (let attempt = 0; attempt < PROFILE_FETCH_RETRIES; attempt += 1) {
      const response = await supabase
        .from("profiles")
        .select("full_name, worker_level, role, company_id, is_active, can_create_devis")
        .eq("id", session.user.id)
        .maybeSingle();

      data = response.data as typeof data;
      error = response.error as Error | null;

      if (error || data) break;

      await wait(250 * (attempt + 1));
    }

    if (error) {
      // Erreur réseau/transitoire : on NE déconnecte PAS l'utilisateur.
      // La session reste active, les données profil seront re-synchronisées plus tard.
      console.warn("[auth] Échec de récupération du profil, session conservée:", error);
      return;
    }

    if (!data) {
      setRole(null);
      return;
    }

    if (!data.is_active) {
      await supabase.auth.signOut();
      resetAuthState();
      alert("Votre compte a été désactivé. Contactez votre administrateur.");
      return;
    }

    if (data.company_id) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("is_active, logo_url, display_name, name")
        .eq("id", data.company_id)
        .maybeSingle();

      if (companyData && !companyData.is_active) {
        await supabase.auth.signOut();
        resetAuthState();
        alert("Votre entreprise a été désactivée. Contactez votre administrateur.");
        return;
      }

      if (companyData) {
        setCompany({
          logo_url: companyData.logo_url,
          display_name: companyData.display_name,
          name: companyData.name,
        });
      }
    }

    setRole((data.role as AppRole) ?? null);
    setProfile({
      full_name: data.full_name,
      worker_level: data.worker_level,
      company_id: data.company_id ?? extractSessionCompanyId(session),
      can_create_devis: data.can_create_devis ?? false,
    });
  }, []);

  const syncAuthState = useCallback(async (session: Session | null) => {
    const requestId = ++syncRequestRef.current;

    setSession(session);
    setUser(session?.user ?? null);

    if (!session?.user) {
      setRole(null);
      setProfile(null);
      setCompany(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    await fetchUserData(session);

    if (syncRequestRef.current !== requestId) return;

    setLoading(false);
  }, [fetchUserData]);

  useEffect(() => {
    let isActive = true;
    let initialDone = false;

    // Nettoyage des brouillons obsolètes au démarrage de la session.
    pruneStaleFicheDrafts();

    const runSync = (nextSession: Session | null) => {
      if (!isActive) return;
      void syncAuthState(nextSession);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION") {
        initialDone = true;
      }

      if (event === "SIGNED_OUT") {
        purgeAllDrafts();
      }

      runSync(nextSession);

      if (nextSession?.user && event === "SIGNED_IN") {
        void supabase.from("activity_logs").insert({
          action: "login",
          actor_id: nextSession.user.id,
          metadata: { email: nextSession.user.email },
        });
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialDone && isActive) {
        initialDone = true;
        runSync(session);
      }
    });

    // Garde la session vivante après une longue inactivité ou une coupure réseau :
    // au retour de l'onglet / de la connexion, on relance le rafraîchissement du token.
    const revive = () => {
      if (!isActive || document.visibilityState !== "visible") return;
      supabase.auth.startAutoRefresh?.();
      void supabase.auth.getSession();
    };
    document.addEventListener("visibilitychange", revive);
    window.addEventListener("online", revive);
    window.addEventListener("focus", revive);

    return () => {
      isActive = false;
      document.removeEventListener("visibilitychange", revive);
      window.removeEventListener("online", revive);
      window.removeEventListener("focus", revive);
      subscription.unsubscribe();
    };
  }, [syncAuthState]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    purgeAllDrafts();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, profile, company, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
