import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "bureau" | "ouvrier" | "super_admin";

interface ProfileData {
  full_name: string;
  worker_level: string | null;
  company_id: string | null;
  can_create_devis: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: ProfileData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const extractSessionRole = (session: Session | null): AppRole | null => {
  const rawRole = session?.user?.user_metadata?.role;
  return rawRole === "admin" || rawRole === "bureau" || rawRole === "ouvrier" || rawRole === "super_admin"
    ? rawRole
    : null;
};

const extractSessionCompanyId = (session: Session | null): string | null => {
  const rawCompanyId = session?.user?.user_metadata?.company_id;
  return typeof rawCompanyId === "string" && rawCompanyId.length > 0 ? rawCompanyId : null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const resetAuthState = () => {
    setSession(null);
    setUser(null);
    setRole(null);
    setProfile(null);
  };

  const applySessionFallback = (session: Session | null) => {
    const sessionRole = extractSessionRole(session);
    const sessionCompanyId = extractSessionCompanyId(session);

    setRole(sessionRole);
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

  const fetchUserData = async (session: Session) => {
    applySessionFallback(session);

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, worker_level, role, company_id, is_active, can_create_devis")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      return;
    }

    if (!data) {
      return;
    }

    if (!data.is_active) {
      await supabase.auth.signOut();
      resetAuthState();
      alert("Votre compte a été désactivé. Contactez votre administrateur.");
      return;
    }

    if (data.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("is_active")
        .eq("id", data.company_id)
        .maybeSingle();

      if (company && !company.is_active) {
        await supabase.auth.signOut();
        resetAuthState();
        alert("Votre entreprise a été désactivée. Contactez votre administrateur.");
        return;
      }
    }

    setRole((data.role as AppRole) ?? extractSessionRole(session) ?? null);
    setProfile({
      full_name: data.full_name,
      worker_level: data.worker_level,
      company_id: data.company_id ?? extractSessionCompanyId(session),
      can_create_devis: data.can_create_devis ?? false,
    });
  };

  const syncAuthState = async (session: Session | null) => {
    setSession(session);
    setUser(session?.user ?? null);

    if (!session?.user) {
      setRole(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    await fetchUserData(session);
    setLoading(false);
  };

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip the initial INITIAL_SESSION event — handled by getSession below
      if (event === "INITIAL_SESSION") return;

      void syncAuthState(session);

      if (session?.user && event === "SIGNED_IN") {
        supabase.from("activity_logs").insert({
          action: "login",
          actor_id: session.user.id,
          metadata: { email: session.user.email },
        }).then(() => {});
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (initialSessionHandled) return;
      initialSessionHandled = true;
      await syncAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
