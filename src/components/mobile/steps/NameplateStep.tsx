import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";

export interface NameplateData {
  brand: string;
  model: string;
  serialNumber: string;
  nominalPower: string;
  usefulPower: string;
  fuelType: string;
  servicePressure: string;
  caloricFlow: string;
  yearOfManufacture: string;
  ceNumber: string;
  category: string;
  otherInfo: string;
}

export const emptyNameplate: NameplateData = {
  brand: "", model: "", serialNumber: "", nominalPower: "", usefulPower: "",
  fuelType: "", servicePressure: "", caloricFlow: "", yearOfManufacture: "",
  ceNumber: "", category: "", otherInfo: "",
};

const FIELDS: { key: keyof NameplateData; label: string }[] = [
  { key: "brand", label: "Marque" },
  { key: "model", label: "Modèle" },
  { key: "serialNumber", label: "Numéro de série" },
  { key: "nominalPower", label: "Puissance nominale (kW)" },
  { key: "usefulPower", label: "Puissance utile (kW)" },
  { key: "fuelType", label: "Type de combustible" },
  { key: "servicePressure", label: "Pression de service (bar)" },
  { key: "caloricFlow", label: "Débit calorifique (kW)" },
  { key: "yearOfManufacture", label: "Année de fabrication" },
  { key: "ceNumber", label: "Numéro CE" },
  { key: "category", label: "Catégorie" },
  { key: "otherInfo", label: "Autres informations" },
];

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.7;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface Props {
  data: NameplateData;
  onChange: (data: NameplateData) => void;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

export default function NameplateStep({ data, onChange, photos, onPhotosChange }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const set = (key: keyof NameplateData, value: string) => onChange({ ...data, [key]: value });

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setCompressing(true);
    const newPhotos = [...photos];
    for (const file of Array.from(files)) {
      try { newPhotos.push(await compressImage(file)); } catch {}
    }
    onPhotosChange(newPhotos);
    setCompressing(false);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Plaque signalétique</h2>

      <div className="bg-primary/5 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-primary">Photo de la plaque</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFiles} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        <Button variant="outline" className="h-12" onClick={() => cameraRef.current?.click()} disabled={compressing}>
          <Camera className="w-4 h-4 mr-1.5" /> Appareil photo
        </Button>
        <Button variant="outline" className="h-12" onClick={() => galleryRef.current?.click()} disabled={compressing}>
          <ImageIcon className="w-4 h-4 mr-1.5" /> Galerie
        </Button>
      </div>

      {compressing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Compression...
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onPhotosChange(photos.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input value={data[key]} onChange={(e) => set(key, e.target.value)} placeholder={label} />
          </div>
        ))}
      </div>
    </div>
  );
}
