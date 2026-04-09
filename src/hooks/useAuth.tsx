import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "bureau" | "ouvrier" | "super_admin";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: { full_name: string; worker_level: string | null; company_id: string | null } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; worker_level: string | null; company_id: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, worker_level, role, company_id, is_active")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      // Check if user is active
      if (!data.is_active) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setRole(null);
        setProfile(null);
        alert("Votre compte a été désactivé. Contactez votre administrateur.");
        return;
      }
      // Check if company is active
      if (data.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("is_active")
          .eq("id", data.company_id)
          .maybeSingle();
        if (company && !company.is_active) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setRole(null);
          setProfile(null);
          alert("Votre entreprise a été désactivée. Contactez votre administrateur.");
          return;
        }
      }
      setRole((data.role as AppRole) ?? null);
      setProfile({ full_name: data.full_name, worker_level: data.worker_level, company_id: data.company_id });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
        // Log login event
        if (event === "SIGNED_IN") {
          supabase.from("activity_logs").insert({
            action: "login",
            actor_id: session.user.id,
            metadata: { email: session.user.email },
          }).then(() => {});
        }
      } else {
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
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
