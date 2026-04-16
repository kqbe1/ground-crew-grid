import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { UnifiedFiche, SortColumn, SortDir } from "./types";
import { TASK_STATUS_LABELS, QUOTE_STATUS_LABELS } from "@/lib/constants";

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  FI: { label: "+FI", className: "bg-blue-500 text-white" },
  FE: { label: "+FE", className: "bg-emerald-500 text-white" },
  FD: { label: "+FD", className: "bg-rose-500 text-white" },
};

const STATUS_COLORS: Record<string, string> = {
  planifie: "bg-blue-500 text-white",
  termine: "bg-emerald-500 text-white",
  a_replanifier: "bg-amber-500 text-white",
  piece_a_commander: "bg-purple-500 text-white",
  sav: "bg-orange-500 text-white",
  en_attente: "bg-amber-500 text-white",
  dossier_en_cours: "bg-blue-500 text-white",
  en_commande: "bg-purple-500 text-white",
  cloture: "bg-emerald-500 text-white",
};

const PAGE_SIZE = 20;

interface Props {
  fiches: UnifiedFiche[];
  onDelete: (fiche: UnifiedFiche) => void;
}

export default function BureauFicheTable({ fiches, onDelete }: Props) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = [...fiches].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case "type": cmp = a.type.localeCompare(b.type); break;
      case "client": cmp = a.clientName.localeCompare(b.clientName); break;
      case "date": cmp = a.date.localeCompare(b.date); break;
      case "status": cmp = a.status.localeCompare(b.status); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleRowClick = (f: UnifiedFiche) => {
    if (f.sourceTable === "quotes") navigate(`/devis/${f.id}`);
    else navigate(`/fiches/${f.id}`);
  };

  const SortButton = ({ col, children }: { col: SortColumn; children: React.ReactNode }) => (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(col)}>
      {children}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]"><SortButton col="type">Type</SortButton></TableHead>
              <TableHead className="w-[60px]">Tech</TableHead>
              <TableHead><SortButton col="client">Client</SortButton></TableHead>
              <TableHead className="hidden md:table-cell">Localité</TableHead>
              <TableHead><SortButton col="date">Date & Heure</SortButton></TableHead>
              <TableHead><SortButton col="status">Statut</SortButton></TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune fiche</TableCell></TableRow>
            )}
            {paginated.map((f) => (
              <TableRow key={`${f.sourceTable}-${f.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(f)}>
                <TableCell>
                  <Badge className={`text-[10px] ${TYPE_BADGE[f.type]?.className}`}>{TYPE_BADGE[f.type]?.label}</Badge>
                </TableCell>
                <TableCell className="text-xs font-medium">{f.techLevel || "—"}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm truncate max-w-[200px]">{f.clientName}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{f.techName}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{f.clientCity || "—"}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(f.date), "dd/MM/yy", { locale: fr })}
                  {f.time && <span className="text-muted-foreground ml-1 text-xs">{f.time}</span>}
                </TableCell>
                <TableCell>
                  <Badge className={`text-[10px] ${STATUS_COLORS[f.status] || ""}`}>{f.statusLabel}</Badge>
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette fiche ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => onDelete(f)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-muted-foreground">Page {page + 1} / {totalPages} — {sorted.length} fiches</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
