import { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import BackButton from "@/components/ui/back-button";

interface LayoutDetailProps {
  /** Élément principal du titre (texte ou JSX) */
  title: ReactNode;
  /** Sous-titre affiché sous le titre (client, date, etc.) */
  subtitle?: ReactNode;
  /** Icône ou badge à afficher entre le bouton retour et le titre */
  icon?: ReactNode;
  /** Badge ou élément complémentaire à droite du bloc titre (ex: type d'intervention) */
  titleAdornment?: ReactNode;
  /** Boutons d'action principaux affichés à droite de l'en-tête */
  actions?: ReactNode;
  /** Barre d'outils optionnelle sous l'en-tête (ex: boutons de statut) */
  toolbar?: ReactNode;
  /** Masquer le séparateur sous l'en-tête */
  hideSeparator?: boolean;
  /** Contenu principal de la page */
  children: ReactNode;
  /** Classe CSS additionnelle pour le conteneur racine */
  className?: string;
}

/**
 * Layout standard pour toutes les pages de détail.
 * Standardise : conteneur, en-tête (bouton retour à gauche + titre + actions),
 * barre d'outils (statuts), séparateur et zone de contenu.
 */
export default function LayoutDetail({
  title,
  subtitle,
  icon,
  titleAdornment,
  actions,
  toolbar,
  hideSeparator,
  children,
  className = "",
}: LayoutDetailProps) {
  return (
    <div className={`p-4 md:p-8 lg:px-12 lg:py-10 space-y-8 ${className}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <BackButton size="icon" variant="ghost" />
            {icon}
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {titleAdornment}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        {toolbar && <div className="flex flex-wrap gap-2">{toolbar}</div>}
      </div>

      {!hideSeparator && <Separator />}

      {children}
    </div>
  );
}
