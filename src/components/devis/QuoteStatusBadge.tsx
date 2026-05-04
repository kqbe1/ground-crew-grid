import { Badge } from "@/components/ui/badge";
import { quoteStatusColor, quoteStatusLabel } from "@/lib/quotesQuery";
import { cn } from "@/lib/utils";

interface Props {
  status: string;
  className?: string;
}

/** Badge unifié pour afficher un statut de devis (page Devis, dashboard, dialogs). */
export default function QuoteStatusBadge({ status, className }: Props) {
  return (
    <Badge className={cn(quoteStatusColor(status), "text-white text-xs", className)}>
      {quoteStatusLabel(status)}
    </Badge>
  );
}