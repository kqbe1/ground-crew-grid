import { useSignedUrls } from "@/hooks/useSignedUrl";
import { ImageIcon } from "lucide-react";

interface Props {
  photos?: string[] | null;
  title?: string;
}

/** Affiche les photos d'une commande de pièce avec des URLs signées régénérées. */
export default function OrderPhotos({ photos, title = "Photos de la pièce" }: Props) {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const signed = useSignedUrls(list, "intervention-photos");
  if (list.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium flex items-center gap-1">
        <ImageIcon className="w-3.5 h-3.5" /> {title}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {signed.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noreferrer">
            <img
              src={url}
              alt={`Photo pièce ${i + 1}`}
              loading="lazy"
              className="w-full aspect-square object-cover rounded border"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
