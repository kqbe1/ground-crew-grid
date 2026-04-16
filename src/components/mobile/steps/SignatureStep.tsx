import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserX } from "lucide-react";
import SignatureCanvas from "@/components/mobile/SignatureCanvas";

export interface SignatureData {
  technicianName: string;
  binomeName: string;
  binomePercentage: number;
  clientAbsent: boolean;
  signatureData: string;
}

interface Props {
  data: SignatureData;
  onChange: (data: SignatureData) => void;
}

export default function SignatureStep({ data, onChange }: Props) {
  const set = (key: keyof SignatureData, value: any) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Signature client</h2>

      <div className="bg-muted/50 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-muted-foreground">Intervenant(s)</span>
      </div>

      <div className="p-3 rounded-xl border border-border">
        <p className="text-sm font-medium">{data.technicianName || "Technicien"}</p>
      </div>

      <div className="p-3 rounded-xl border border-border space-y-3">
        <p className="text-sm font-semibold">Binôme</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Nom du binôme</Label>
          <input
            type="text"
            value={data.binomeName}
            onChange={(e) => set("binomeName", e.target.value)}
            placeholder="Nom du binôme (optionnel)"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Pourcentage binôme</Label>
          <Select value={String(data.binomePercentage)} onValueChange={(v) => set("binomePercentage", parseInt(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 11 }, (_, i) => i * 10).map((pct) => (
                <SelectItem key={pct} value={String(pct)}>{pct}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <UserX className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Client absent</span>
        </div>
        <Switch checked={data.clientAbsent} onCheckedChange={(v) => set("clientAbsent", v)} />
      </div>

      {!data.clientAbsent && (
        <>
          <div className="bg-primary/5 rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-primary">Signature du client</span>
          </div>
          <SignatureCanvas
            value={data.signatureData}
            onSignatureChange={(v) => set("signatureData", v)}
          />
          {data.signatureData && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => set("signatureData", "")}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Effacer la signature
            </Button>
          )}
        </>
      )}
    </div>
  );
}
