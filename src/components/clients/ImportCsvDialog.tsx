import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertTriangle, Check } from "lucide-react";

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const CLIENT_FIELDS = [
  { key: "name", label: "Nom", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Téléphone" },
  { key: "phone_secondary", label: "Téléphone secondaire" },
  { key: "address_intervention", label: "Adresse intervention" },
  { key: "address_billing", label: "Coordonnées de facturation" },
  { key: "contact_syndic", label: "Contact syndic" },
  { key: "contact_locataire", label: "Contact locataire" },
  { key: "syndic_keys_codes", label: "Clés / codes syndic" },
  { key: "notes_internal", label: "Notes internes" },
  { key: "region", label: "Région" },
  { key: "birthday", label: "Date anniversaire" },
] as const;

const IGNORE = "__ignore__";

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const sep = lines[0].includes(";") ? ";" : ",";

  const parse = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === sep && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(parse);
  return { headers, rows };
}

function autoMap(csvHeaders: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  const aliases: Record<string, string[]> = {
    name: ["nom", "name", "raison sociale", "société", "client", "company", "raison_sociale"],
    email: ["email", "e-mail", "mail", "courriel"],
    phone: ["téléphone", "telephone", "phone", "tel", "tél", "mobile"],
    phone_secondary: ["téléphone 2", "phone 2", "tel2", "mobile 2"],
    address_intervention: ["adresse", "address", "adresse intervention", "adresse_intervention"],
    address_billing: ["adresse facturation", "adresse_facturation", "billing", "facturation"],
    contact_syndic: ["syndic", "contact syndic", "contact_syndic"],
    contact_locataire: ["locataire", "contact locataire", "contact_locataire"],
    syndic_keys_codes: ["clés", "codes", "keys", "syndic_keys_codes"],
    notes_internal: ["notes", "remarques", "commentaires", "notes_internal"],
    region: ["région", "region"],
    birthday: ["anniversaire", "birthday", "date naissance"],
  };

  csvHeaders.forEach((h, i) => {
    const norm = h.toLowerCase().trim();
    for (const [field, keywords] of Object.entries(aliases)) {
      if (keywords.some((k) => norm === k || norm.includes(k))) {
        if (!Object.values(mapping).includes(field)) {
          mapping[i] = field;
          break;
        }
      }
    }
  });
  return mapping;
}

const VALID_REGIONS = ["bruxelles", "wallonie", "flandre"];

export default function ImportCsvDialog({ open, onOpenChange, onImported }: ImportCsvDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ total: number; ok: number; skipped: number } | null>(null);

  const reset = () => {
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setResult(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCsv(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(autoMap(headers));
    };
    reader.readAsText(file, "UTF-8");
  };

  const updateMapping = (colIdx: number, field: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (field === IGNORE) { delete next[colIdx]; } else { next[colIdx] = field; }
      return next;
    });
  };

  const nameColIdx = Object.entries(mapping).find(([, v]) => v === "name")?.[0];

  const handleImport = async () => {
    if (nameColIdx === undefined) {
      toast.error("Mappez au moins la colonne « Nom »");
      return;
    }
    setImporting(true);
    let ok = 0;
    let skipped = 0;
    const duplicates: string[] = [];

    // Fetch existing clients for duplicate detection
    const { data: existing } = await supabase.from("clients").select("name, email");
    const existingNames = new Set((existing ?? []).map((c) => c.name?.toLowerCase().trim()));
    const existingEmails = new Set(
      (existing ?? []).filter((c) => c.email).map((c) => c.email!.toLowerCase().trim())
    );

    const emailColIdx = Object.entries(mapping).find(([, v]) => v === "email")?.[0];

    for (const row of csvRows) {
      const record: Record<string, string | null> = {};
      for (const [colStr, field] of Object.entries(mapping)) {
        const val = row[Number(colStr)]?.trim() || null;
        if (field === "region" && val) {
          const norm = val.toLowerCase().trim();
          record[field] = VALID_REGIONS.includes(norm) ? norm : null;
        } else {
          record[field] = val;
        }
      }
      if (!record.name) { skipped++; continue; }

      // Duplicate check by name
      const nameLower = record.name.toLowerCase().trim();
      if (existingNames.has(nameLower)) {
        duplicates.push(record.name);
        skipped++;
        continue;
      }

      // Duplicate check by email
      if (record.email) {
        const emailLower = record.email.toLowerCase().trim();
        if (existingEmails.has(emailLower)) {
          duplicates.push(`${record.name} (${record.email})`);
          skipped++;
          continue;
        }
      }

      const { error } = await supabase.from("clients").insert(record as any);
      if (error) {
        skipped++;
      } else {
        ok++;
        // Add to sets to catch intra-CSV duplicates too
        existingNames.add(nameLower);
        if (record.email) existingEmails.add(record.email.toLowerCase().trim());
      }
    }

    setResult({ total: csvRows.length, ok, skipped, duplicates });
    setImporting(false);
    if (ok > 0) {
      toast.success(`${ok} client(s) importé(s)`);
      onImported();
    }
    if (duplicates.length > 0) {
      toast.warning(`${duplicates.length} doublon(s) détecté(s)`);
    }
  };

  const usedFields = new Set(Object.values(mapping));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Importer des clients (CSV)
          </DialogTitle>
          <DialogDescription>
            Importez un fichier CSV exporté depuis Odoo ou un autre outil. Les colonnes manquantes seront ignorées.
          </DialogDescription>
        </DialogHeader>

        {/* File picker */}
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full border-dashed h-20">
          <Upload className="w-5 h-5 mr-2" />
          {csvHeaders.length > 0 ? `${csvRows.length} ligne(s) détectées` : "Choisir un fichier CSV"}
        </Button>

        {/* Column mapping */}
        {csvHeaders.length > 0 && !result && (
          <>
            <div className="text-sm font-medium text-muted-foreground">Correspondance des colonnes</div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colonne CSV</TableHead>
                    <TableHead>Champ client</TableHead>
                    <TableHead>Aperçu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvHeaders.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{h}</TableCell>
                      <TableCell>
                        <Select value={mapping[i] ?? IGNORE} onValueChange={(v) => updateMapping(i, v)}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORE}>— Ignorer —</SelectItem>
                            {CLIENT_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key} disabled={usedFields.has(f.key) && mapping[i] !== f.key}>
                                {f.label} {"required" in f && f.required ? "*" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {csvRows[0]?.[i] || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {nameColIdx === undefined && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4" />
                La colonne « Nom » est obligatoire
              </div>
            )}

            <Button onClick={handleImport} disabled={importing || nameColIdx === undefined} className="w-full">
              {importing ? "Import en cours..." : `Importer ${csvRows.length} client(s)`}
            </Button>
          </>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3 text-center py-4">
            <Check className="w-10 h-10 mx-auto text-[hsl(var(--color-termine))]" />
            <div className="text-lg font-semibold">{result.ok} client(s) importé(s)</div>
            {result.skipped > 0 && (
              <Badge variant="outline" className="text-destructive border-destructive">
                {result.skipped} ligne(s) ignorée(s) (nom manquant ou doublon)
              </Badge>
            )}
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
