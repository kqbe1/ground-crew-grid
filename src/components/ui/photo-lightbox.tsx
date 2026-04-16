import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

interface PhotoLightboxProps {
  photos: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoLightbox({ photos, initialIndex = 0, open, onOpenChange }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  const current = photos[index] || "";
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const handleDownload = async () => {
    try {
      const res = await fetch(current);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photo-${index + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(current, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none flex flex-col items-center justify-center gap-0 [&>button]:hidden">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white/80 text-sm font-medium">{index + 1} / {photos.length}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleDownload}>
              <Download className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Image */}
        <img
          src={current}
          alt={`Photo ${index + 1}`}
          className="max-w-full max-h-[85vh] object-contain select-none"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Navigation */}
        {hasPrev && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 w-10 h-10"
            onClick={() => setIndex(i => i - 1)}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        {hasNext && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 w-10 h-10"
            onClick={() => setIndex(i => i + 1)}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PhotoGridProps {
  photos: string[];
  label: string;
}

export function PhotoGrid({ photos, label }: PhotoGridProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleDownloadAll = async () => {
    for (let i = 0; i < photos.length; i++) {
      try {
        const res = await fetch(photos[i]);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${label.toLowerCase().replace(/\s+/g, "-")}-${i + 1}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        window.open(photos[i], "_blank");
      }
    }
  };

  if (photos.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">{label} ({photos.length})</h2>
        <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={handleDownloadAll}>
          <Download className="w-3.5 h-3.5" />
          Tout télécharger
        </Button>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
        {photos.map((url, i) => (
          <button
            key={i}
            className="relative group cursor-pointer"
            onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
          >
            <img src={url} alt={`${label} ${i + 1}`} className="rounded-lg object-cover aspect-square w-full group-hover:opacity-80 transition" />
            <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30">
              <span className="text-white text-xs font-medium">Agrandir</span>
            </div>
          </button>
        ))}
      </div>
      <PhotoLightbox photos={photos} initialIndex={lightboxIndex} open={lightboxOpen} onOpenChange={setLightboxOpen} />
    </section>
  );
}
