import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface PhotoCaptureProps {
  label: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export default function PhotoCapture({ label, photos, onPhotosChange, maxPhotos = 5 }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (photos.length >= maxPhotos) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        onPhotosChange([...photos, dataUrl]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">{label}</p>

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

      {photos.length < maxPhotos && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapture}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="w-4 h-4 mr-1.5" />
            Prendre une photo ({photos.length}/{maxPhotos})
          </Button>
        </>
      )}
    </div>
  );
}
