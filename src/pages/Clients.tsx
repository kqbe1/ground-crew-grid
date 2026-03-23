import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Phone, Mail, MapPin } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import CreateEditClientDialog from "@/components/clients/CreateEditClientDialog";
import ClientDetailDialog from "@/components/clients/ClientDetailDialog";

type Client = Tables<"clients">;

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    const query = supabase.from("clients").select("*").order("name");
    if (search) query.ilike("name", `%${search}%`);
    const { data } = await query;
    setClients(data ?? []);
  }, [search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleCardClick = (client: Client) => setDetailClient(client);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">{clients.length} client(s)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouveau client</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <Card key={client.id} className="hover:shadow-md transition-shadow cursor-pointer animate-slide-in" onClick={() => handleCardClick(client)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{client.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {client.phone}
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" /> {client.email}
                </div>
              )}
              {client.address_intervention && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" /> <span className="truncate">{client.address_intervention}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {clients.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">Aucun client trouvé</div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <CreateEditClientDialog
        open={createOpen || !!editClient}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditClient(null); } }}
        client={editClient}
        onSaved={fetchClients}
      />

      {/* Detail dialog */}
      <ClientDetailDialog
        open={!!detailClient}
        onOpenChange={(open) => { if (!open) setDetailClient(null); }}
        client={detailClient}
        onEdit={() => { setEditClient(detailClient); setDetailClient(null); }}
      />
    </div>
  );
}
