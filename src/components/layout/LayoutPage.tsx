import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface LayoutPageProps {
  /** Titre principal de la page (H1) */
  title: ReactNode;
  /** Sous-titre / description courte */
  subtitle?: ReactNode;
  /** Icône à gauche du titre */
  icon?: LucideIcon;
  /** Badge ou élément complémentaire à droite du titre */
  titleAdornment?: ReactNode;
  /** Boutons d'action principaux à droite de l'en-tête */
  actions?: ReactNode;
  /** Barre de filtres / outils sous l'en-tête */
  toolbar?: ReactNode;
  /** Contenu principal */
  children: ReactNode;
  className?: string;
}

/**
 * Layout standard pour toutes les pages liste / index.
 * Standardise : conteneur, en-tête (titre à gauche + actions à droite),
 * barre d'outils optionnelle et zone de contenu, avec les mêmes
 * espacements que LayoutDetail.
 */
export default function LayoutPage({
  title,
  subtitle,
  icon: Icon,
  titleAdornment,
  actions,
  toolbar,
  children,
  className = "",
}: LayoutPageProps) {
  return (
    <div className={`p-4 md:p-8 lg:px-12 lg:py-10 space-y-6 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && <Icon className="w-5 h-5 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {titleAdornment}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {toolbar && <div className="flex flex-wrap gap-3">{toolbar}</div>}

      {children}
    </div>
  );
}
