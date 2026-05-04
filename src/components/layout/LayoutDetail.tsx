import { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import BackButton from "@/components/ui/back-button";
import { Loader2, AlertCircle, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayoutDetailProps {
  /** Élément principal du titre (texte ou JSX) */
  title?: ReactNode;
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
  /** État de chargement : affiche un spinner standardisé */
  loading?: boolean;
  /** Erreur (Error ou message string) : affiche un état d'erreur standardisé */
  error?: Error | string | null;
  /** Si true, affiche l'état "ressource introuvable" standardisé */
  notFound?: boolean;
  /** Libellé de la ressource pour les messages (ex: "Devis", "Tâche") */
  resourceLabel?: string;
  /** Callback de réessai pour l'erreur (affiche un bouton "Réessayer") */
  onRetry?: () => void;
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
  loading,
  error,
  notFound,
  resourceLabel = "Élément",
  onRetry,
}: LayoutDetailProps) {
  const renderState = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Chargement…</p>
        </div>
      );
    }
    if (error) {
      const message = typeof error === "string" ? error : error.message || "Une erreur est survenue";
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="p-3 rounded-full bg-destructive/10">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="font-medium">Impossible de charger {resourceLabel.toLowerCase()}</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>Réessayer</Button>
          )}
        </div>
      );
    }
    if (notFound) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="p-3 rounded-full bg-muted">
            <FileQuestion className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{resourceLabel} introuvable</p>
        </div>
      );
    }
    return null;
  };

  const stateContent = renderState();
  const isStateView = loading || error || notFound;
  const showHeader = !loading; // header visible sauf en loading complet
  const headerTitle = isStateView ? (resourceLabel) : title;

  return (
    <div className={`p-4 md:p-8 lg:px-12 lg:py-10 space-y-8 ${className}`}>
      {showHeader && (
        <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <BackButton size="icon" variant="ghost" />
            {!isStateView && icon}
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{headerTitle}</h1>
              {!isStateView && subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {!isStateView && titleAdornment}
          </div>
          {actions && !error && !notFound && (
            <div className="flex items-center gap-2 flex-wrap">{actions}</div>
          )}
        </div>

        {toolbar && !error && !notFound && <div className="flex flex-wrap gap-2">{toolbar}</div>}
        </div>
      )}

      {!hideSeparator && showHeader && <Separator />}

      {stateContent ?? children}
    </div>
  );
}
