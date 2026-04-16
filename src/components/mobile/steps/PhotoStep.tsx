import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";

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
  title: string;
  sectionLabel: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  observations?: string;
  onObservationsChange?: (v: string) => void;
  showObservations?: boolean;
}

export default function PhotoStep({
  title,
  sectionLabel,
  photos,
  onPhotosChange,
  observations,
  onObservationsChange,
  showObservations = false,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setCompressing(true);
    const newPhotos = [...photos];
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file);
        newPhotos.push(compressed);
      } catch {
        // skip
      }
    }
    onPhotosChange(newPhotos);
    setCompressing(false);
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>

      {showObservations && (
        <div className="space-y-1.5">
          <Label>Observations à l'arrivée (optionnel)</Label>
          <Textarea
            value={observations || ""}
            onChange={(e) => onObservationsChange?.(e.target.value)}
            placeholder="Observations à l'arrivée..."
            rows={3}
          />
        </div>
      )}

      <div className="bg-primary/5 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-primary">{sectionLabel}</span>
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
              <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
