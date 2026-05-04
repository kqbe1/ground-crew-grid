import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSearch } from "@/lib/searchUtils";
import { Plus, Search, Phone, Mail, MapPin, Upload, Download } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import CreateEditClientDialog from "@/components/clients/CreateEditClientDialog";
import ImportCsvDialog from "@/components/clients/ImportCsvDialog";

type Client = Tables<"clients">;

export default function Clients() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data ?? []);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = normalizeSearch(search);
    return clients.filter((c) =>
      [c.name, c.email, c.phone, c.address_intervention]
        .map(normalizeSearch)
        .some((s) => s.includes(q))
    );
  }, [clients, search]);

  const exportCsv = () => {
    const headers = ["Nom","Email","Téléphone","Tél. secondaire","Adresse intervention","Coordonnées facturation","Contact syndic","Contact locataire","Clés/codes syndic","Notes internes","Région","Anniversaire"];
    const rows = clients.map((c) => [c.name, c.email ?? "", c.phone ?? "", c.phone_secondary ?? "", c.address_intervention ?? "", c.address_billing ?? "", c.contact_syndic ?? "", c.contact_locataire ?? "", c.syndic_keys_codes ?? "", c.notes_internal ?? "", c.region ?? "", c.birthday ?? ""]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">{clients.length} client(s)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" /> Importer</Button>
          <Button size={isMobile ? "sm" : "default"} onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Nouveau</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {!isMobile ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Adresse intervention</TableHead>
                <TableHead>Région</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clients/${client.id}`)}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.phone && <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3.5 h-3.5" /> {client.phone}</span>}</TableCell>
                  <TableCell>{client.email && <span className="flex items-center gap-1.5 text-muted-foreground"><Mail className="w-3.5 h-3.5" /> {client.email}</span>}</TableCell>
                  <TableCell>{client.address_intervention && <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> <span className="truncate max-w-[250px] inline-block">{client.address_intervention}</span></span>}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{client.region ?? "—"}</TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">Aucun client trouvé</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Card key={client.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/clients/${client.id}`)}>
              <CardContent className="py-3 space-y-1">
                <p className="font-medium">{client.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</span>}
                  {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>}
                </div>
                {client.address_intervention && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" /> {client.address_intervention}</p>}
              </CardContent>
            </Card>
          ))}
          {clients.length === 0 && <div className="py-12 text-center text-muted-foreground">Aucun client trouvé</div>}
        </div>
      )}

      <CreateEditClientDialog
        open={createOpen || !!editClient}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditClient(null); } }}
        client={editClient}
        onSaved={fetchClients}
      />
      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} onImported={fetchClients} />
    </div>
  );
}
