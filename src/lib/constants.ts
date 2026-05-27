export const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  entretien_gaz: "Entretien Gaz",
  entretien_mazout: "Entretien Mazout",
  entretien_pellets: "Entretien Pellets",
  entretien_clim: "Entretien Clim",
  entretien_vmc: "Entretien VMC",
  depannage: "Dépannage",
  installation: "Installation",
  remplacement: "Remplacement",
  rdv_divers: "RDV Divers",
  autre: "Autre",
};

export const INTERVENTION_TYPE_COLORS: Record<string, string> = {
  entretien_gaz: "badge-gaz",
  entretien_mazout: "badge-mazout",
  entretien_pellets: "badge-pellets",
  entretien_clim: "badge-clim",
  entretien_vmc: "badge-vmc",
  depannage: "badge-depannage",
  installation: "badge-installation",
  remplacement: "badge-remplacement",
  rdv_divers: "badge-rdv",
  autre: "badge-autre",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  planifie: "Planifié",
  termine: "Terminé",
  a_replanifier: "À replanifier",
  piece_a_commander: "Pièce à commander",
  sav: "SAV",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  planifie: "badge-status-planifie",
  termine: "badge-status-termine",
  a_replanifier: "badge-status-a_replanifier",
  piece_a_commander: "badge-status-piece_a_commander",
  sav: "badge-status-sav",
};

export const ROLE_BADGE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  bureau: "Bureau",
  ouvrier: "Ouvrier",
};

export const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin: "badge-role-super_admin",
  admin: "badge-role-admin",
  bureau: "badge-role-bureau",
  ouvrier: "badge-role-ouvrier",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  demandee: "Demandée",
  commandee: "Commandée",
  recue: "Reçue",
  cloturee: "Clôturée",
};

export const WORKER_LEVEL_LABELS: Record<string, string> = {
  T0: "T0 - Apprenti",
  T1: "T1 - Ouvrier",
  T2: "T2 - Chef d'équipe",
  T3: "T3 - Technicien",
  T4: "T4 - Technicien senior",
  T5: "T5 - Responsable technique",
};

export const WORKER_LEVELS = ["T0", "T1", "T2", "T3", "T4", "T5"] as const;

export const ENERGY_TYPE_LABELS: Record<string, string> = {
  gaz: "Gaz",
  mazout: "Mazout",
  pellets: "Pellets",
  electricite: "Électricité",
  clim: "Climatisation",
  vmc: "VMC",
  autre: "Autre",
};

export const PERIODICITY_LABELS: Record<string, string> = {
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  semestriel: "Semestriel",
  annuel: "Annuel",
  bisannuel: "Bisannuel",
  triennal: "Triennal",
};

// Grouped filter options: single "Entretien" entry covering all entretien_* subtypes
export const ENTRETIEN_SUBTYPES = ["entretien_gaz", "entretien_mazout", "entretien_pellets", "entretien_clim", "entretien_vmc"];
export const STANDALONE_INTERVENTION_TYPES = ["depannage", "installation", "remplacement", "rdv_divers", "autre"];

export const FILTER_TYPE_GROUPS = [
  { key: "entretien", label: "Entretien", types: ENTRETIEN_SUBTYPES },
  ...STANDALONE_INTERVENTION_TYPES.map((t) => ({ key: t, label: INTERVENTION_TYPE_LABELS[t], types: [t] })),
];

// Réexports — la source unique de vérité vit dans `@/lib/quotesQuery`.
export {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUSES,
} from "@/lib/quotesQuery";

export const INSTALLATION_TYPE_LABELS: Record<string, string> = {
  chaudiere: "Chaudière",
  climatisation: "Climatisation",
  vmc: "VMC",
  salle_de_bain: "Salle de bain",
  autre: "Autre",
};

export const INSTALLATION_TYPE_ICONS: Record<string, string> = {
  chaudiere: "wrench",
  climatisation: "snowflake",
  vmc: "wind",
  salle_de_bain: "droplets",
  autre: "settings",
};

export const DEVIS_CHECKLISTS: Record<string, string[]> = {
  chaudiere: [
    "Évacuation ancienne chaudière",
    "Nouvelle alimentation d'électricité",
    "Cheminée existante",
    "Placement thermostat",
    "Raccordement gaz",
    "Raccordement eau",
    "Mise en service",
    "Tubage cheminée",
    "Vase d'expansion",
    "Circulateur",
  ],
  climatisation: [
    "Distance entre les éléments (m)",
    "Hauteur approximative unité extérieure (m)",
    "Nombre de splits intérieurs",
    "Passage de gaines",
    "Alimentation électrique dédiée",
    "Support mural/sol unité extérieure",
    "Évacuation condensats",
  ],
  vmc: [
    "Type VMC (simple flux / double flux)",
    "Nombre de bouches d'extraction",
    "Nombre de bouches d'insufflation",
    "Passage de gaines",
    "Sortie toiture existante",
    "Alimentation électrique",
    "Isolation des gaines",
  ],
  salle_de_bain: [
    "Plomberie existante",
    "Évacuation existante",
    "Carrelage à poser",
    "Électricité à revoir",
    "Meuble vasque",
    "Douche / Baignoire",
    "WC à installer",
    "Sèche-serviettes",
    "Ventilation",
  ],
  autre: [
    "Alimentation électrique",
    "Alimentation eau",
    "Évacuation",
    "Accès chantier",
    "Protection sols/murs",
  ],
};