import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ENTRETIEN_SUBTYPES } from "@/lib/constants";
import MobileFicheInterventionForm from "./MobileFicheInterventionForm";
import MobileFicheEntretienForm from "./MobileFicheEntretienForm";

export default function MobileFicheRouter() {
  const { taskId } = useParams();
  const [formType, setFormType] = useState<"intervention" | "entretien" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      const { data } = await supabase
        .from("work_tasks")
        .select("intervention_type")
        .eq("id", taskId)
        .maybeSingle();

      if (data && ENTRETIEN_SUBTYPES.includes(data.intervention_type)) {
        setFormType("entretien");
      } else {
        setFormType("intervention");
      }
      setLoading(false);
    })();
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return formType === "entretien" ? <MobileFicheEntretienForm /> : <MobileFicheInterventionForm />;
}
