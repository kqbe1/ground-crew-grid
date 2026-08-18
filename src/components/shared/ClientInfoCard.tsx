import { Card, CardContent } from "@/components/ui/card";
import { User, Home } from "lucide-react";

/** Champs client à sélectionner pour afficher une fiche client complète (propriétaire inclus). */
export const CLIENT_FULL_SELECT =
  "id, name, email, phone, phone_secondary, address_intervention, address_billing, postal_code, city, contact_syndic, contact_locataire, syndic_keys_codes, notes_internal, owner_client_id, owner:owner_client_id(id, name, phone, phone_secondary, email, address_intervention, postal_code, city)";

export function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}

const tel = (v?: string | null) => (v ? <a className="underline" href={`tel:${v}`}>{v}</a> : null);
const mail = (v?: string | null) => (v ? <a className="underline" href={`mailto:${v}`}>{v}</a> : null);

/** Bloc "Propriétaire" affiché si le client est lié à un propriétaire / syndic. */
export function OwnerInfoCard({ owner }: { owner: any }) {
  if (!owner) return null;
  return (
    <Card>
      <CardContent className="p-3 grid gap-2 text-sm">
        <p className="font-medium flex items-center gap-1 mb-1"><Home className="w-4 h-4" /> Propriétaire</p>
        <Row label="Nom et prénom" value={owner.name} />
        <Row label="Téléphone" value={tel(owner.phone)} />
        <Row label="Téléphone 2" value={tel(owner.phone_secondary)} />
        <Row label="Email" value={mail(owner.email)} />
        <Row label="Adresse" value={[owner.address_intervention, [owner.postal_code, owner.city].filter(Boolean).join(" ")].filter(Boolean).join(" — ")} />
      </CardContent>
    </Card>
  );
}

export default function ClientInfoCard({ client, title = "Client" }: { client: any; title?: string }) {
  if (!client) return null;
  return (
    <>
      <Card>
        <CardContent className="p-3 grid gap-2 text-sm">
          <p className="font-medium flex items-center gap-1 mb-1"><User className="w-4 h-4" /> {title}</p>
          <Row label="Nom" value={client.name} />
          <Row label="Téléphone" value={tel(client.phone)} />
          <Row label="Téléphone 2" value={tel(client.phone_secondary)} />
          <Row label="Email" value={mail(client.email)} />
          <Row label="Adresse d'intervention" value={client.address_intervention} />
          <Row label="Code postal / Ville" value={[client.postal_code, client.city].filter(Boolean).join(" ")} />
          <Row label="Adresse de facturation" value={client.address_billing} />
          <Row label="Contact syndic" value={client.contact_syndic} />
          <Row label="Contact locataire" value={client.contact_locataire} />
          <Row label="Clés / codes" value={client.syndic_keys_codes} />
          <Row label="Notes internes" value={client.notes_internal} />
        </CardContent>
      </Card>
      <OwnerInfoCard owner={client.owner} />
    </>
  );
}
