import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Invisible component that listens for work_task changes
 * relevant to the current ouvrier and shows toast notifications.
 */
export default function MobileTaskNotifications() {
  const { user, role } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || role !== "ouvrier") return;

    channelRef.current = supabase
      .channel("mobile-task-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "work_tasks", filter: `assigned_to=eq.${user.id}` },
        async (payload) => {
          const task = payload.new as any;
          let client: any = null;
          if (task.client_id) {
            const { data: clients } = await supabase.rpc("get_my_clients_safe");
            client = (clients ?? []).find((c: any) => c.id === task.client_id) ?? null;
          }

          toast.info("📋 Nouvelle tâche assignée", {
            description: `${task.title}${client?.name ? ` · ${client.name}` : ""}`,
            duration: 6000,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "work_tasks", filter: `assigned_to=eq.${user.id}` },
        async (payload) => {
          const task = payload.new as any;
          const old = payload.old as any;

          // Don't notify for status changes made by the ouvrier themselves
          // (e.g. when they complete a task via intervention sheet)
          if (task.status !== old.status && task.status !== "planifie") return;

          const changes: string[] = [];
          if (task.scheduled_date !== old.scheduled_date) changes.push("date");
          if (task.start_time !== old.start_time) changes.push("heure");
          if (task.duration_minutes !== old.duration_minutes) changes.push("durée");
          if (task.title !== old.title) changes.push("titre");
          if (task.description !== old.description) changes.push("description");
          if (task.memo_secretariat !== old.memo_secretariat) changes.push("mémo");
          if (task.material_needed !== old.material_needed) changes.push("matériel");

          if (changes.length === 0) return;

          toast.info("🔄 Tâche modifiée par le bureau", {
            description: `${task.title} — ${changes.join(", ")}`,
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [user, role]);

  return null;
}
