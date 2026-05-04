import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Camera, Image as ImageIcon, X, Loader2, Info } from "lucide-react";

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
  internalComment: string;
  onCommentChange: (v: string) => void;
  internalPhotos: string[];
  onPhotosChange: (photos: string[]) => void;
  showDescription?: boolean;
  description?: string;
  onDescriptionChange?: (v: string) => void;
}

export default function InternalStep({
  title,
  internalComment,
  onCommentChange,
  internalPhotos,
  onPhotosChange,
  showDescription = false,
  description,
  onDescriptionChange,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setCompressing(true);
    const newPhotos = [...internalPhotos];
    for (const file of Array.from(files)) {
      try { newPhotos.push(await compressImage(file)); } catch {}
    }
    onPhotosChange(newPhotos);
    setCompressing(false);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>

      {showDescription && (
        <>
          <div className="bg-primary/5 rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-primary">Description du travail</span>
          </div>
          <Textarea
            value={description || ""}
            onChange={(e) => onDescriptionChange?.(e.target.value)}
            placeholder="Décrivez le travail effectué ici..."
            rows={4}
          />
        </>
      )}

      <div className="bg-muted/50 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-muted-foreground">Commentaire interne</span>
      </div>

      <Textarea
        value={internalComment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Commentaire interne (visible uniquement par le secrétariat)"
        rows={3}
      />

      <div className="flex gap-2 p-3 rounded-lg alert-info border">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="text-xs">
          Ajoutez ici les photos des notes d'envoi, factures ou bons de commande liés à cette intervention. Visible uniquement par le secrétariat.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-muted-foreground">Notes d'envoi / Factures</span>
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

      {internalPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {internalPhotos.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onPhotosChange(internalPhotos.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
