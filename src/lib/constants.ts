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
};

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