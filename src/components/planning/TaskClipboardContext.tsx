import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import type { Database } from "@/integrations/supabase/types";

type InterventionType = Database["public"]["Enums"]["intervention_type"];

interface CopiedTask {
  title: string;
  description: string | null;
  duration_minutes: number;
  intervention_type: InterventionType;
  client_id: string | null;
  client_site_id: string | null;
  equipment_id: string | null;
  template_id: string | null;
  material_needed: string | null;
  memo_secretariat: string | null;
  second_assigned_to: string | null;
}

interface TaskClipboardContextType {
  copiedTask: CopiedTask | null;
  copyTask: (task: any) => void;
  clearClipboard: () => void;
}

const TaskClipboardContext = createContext<TaskClipboardContextType>({
  copiedTask: null,
  copyTask: () => {},
  clearClipboard: () => {},
});

export function TaskClipboardProvider({ children }: { children: ReactNode }) {
  const [copiedTask, setCopiedTask] = useState<CopiedTask | null>(null);

  const copyTask = useCallback((task: any) => {
    setCopiedTask({
      title: task.title,
      description: task.description,
      duration_minutes: task.duration_minutes,
      intervention_type: task.intervention_type,
      client_id: task.client_id,
      client_site_id: task.client_site_id,
      equipment_id: task.equipment_id,
      template_id: task.template_id,
      material_needed: task.material_needed,
      memo_secretariat: task.memo_secretariat,
      second_assigned_to: task.second_assigned_to,
    });
  }, []);

  const clearClipboard = useCallback(() => setCopiedTask(null), []);

  return (
    <TaskClipboardContext.Provider value={{ copiedTask, copyTask, clearClipboard }}>
      {children}
    </TaskClipboardContext.Provider>
  );
}

export function useTaskClipboard() {
  return useContext(TaskClipboardContext);
}
