import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface CoordinatesData {
  clientName: string;
  clientAddress: string;
  clientPostal: string;
  clientCity: string;
  clientPhone: string;
  clientEmail: string;
  billingSame: boolean;
  billingName: string;
  billingAddress: string;
  billingPostal: string;
  billingCity: string;
  billingPhone: string;
  billingEmail: string;
}

interface Props {
  data: CoordinatesData;
  onChange: (data: CoordinatesData) => void;
}

export default function CoordinatesStep({ data, onChange }: Props) {
  const set = (key: keyof CoordinatesData, value: any) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Coordonnées intervention</h2>

      <div className="bg-primary/5 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-primary">Lieu d'intervention</span>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Nom et prénom du client *</Label>
          <Input value={data.clientName} onChange={(e) => set("clientName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Adresse complète</Label>
          <Input value={data.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Code postal</Label>
            <Input value={data.clientPostal} onChange={(e) => set("clientPostal", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ville</Label>
            <Input value={data.clientCity} onChange={(e) => set("clientCity", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Téléphone</Label>
          <Input value={data.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email facturation *</Label>
          <Input value={data.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} type="email" />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <div className="bg-primary/5 rounded-lg px-3 py-2">
          <span className="text-sm font-semibold text-primary">Facturation</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="billing-same"
            checked={data.billingSame}
            onCheckedChange={(v) => set("billingSame", !!v)}
          />
          <Label htmlFor="billing-same">Facturation identique aux coordonnées d'intervention</Label>
        </div>

        {!data.billingSame && (
          <div className="space-y-3 pl-1">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={data.billingName} onChange={(e) => set("billingName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Adresse</Label>
              <Input value={data.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code postal</Label>
                <Input value={data.billingPostal} onChange={(e) => set("billingPostal", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ville</Label>
                <Input value={data.billingCity} onChange={(e) => set("billingCity", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={data.billingPhone} onChange={(e) => set("billingPhone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={data.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} type="email" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
