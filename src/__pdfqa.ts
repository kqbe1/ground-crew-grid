import { generateFichePdf } from "@/lib/generateFichePdf";
import { writeFileSync } from "fs";
const sheet = {
  id: "99dfcada-c2aa-40a0-a6bb-c2a3a3430b87",
  created_at: new Date().toISOString(),
  final_status: "termine",
  work_status_details: ["termine", "piece_a_commander"],
  work_status_notes: { termine: "Chaudière remise en service", piece_a_commander: "Vanne 3 voies à commander" },
  description: "Entretien complet de la chaudière, nettoyage du corps de chauffe, contrôle des sécurités et réglage de la combustion. ".repeat(3),
  observations_before: "Chaudière en fonctionnement, légère fuite au groupe de sécurité.",
  supplies_description: "NE DOIT PAS APPARAITRE",
  internal_comment: "NE DOIT PAS APPARAITRE",
  arrival_time: new Date("2026-06-23T08:00:00Z").toISOString(),
  departure_time: new Date("2026-06-23T12:30:00Z").toISOString(),
  client_present: true, client_absent: false,
  checklist_results: [{ label: "Nettoyage brûleur", checked: true }, { label: "Contrôle étanchéité gaz", checked: true }, { label: "Analyse de combustion", checked: false }],
  nameplate_data: { brand: "Vaillant", model: "ecoTEC plus", serialNumber: "21-4567-889", nominalPower: "24 kW", fuelType: "Gaz naturel", yearOfManufacture: "2019" },
  photos_before: [], photos_after: [], photos_nameplate: [],
  work_tasks: {
    title: "Entretien annuel chaudière gaz",
    description: "Entretien légal annuel + contrôle conduit",
    intervention_type: "entretien_gaz",
    scheduled_date: "2026-06-23",
    start_time: "08:00", duration_minutes: 240,
    client_sites: { name: "Résidence Les Tilleuls", address: "Rue de la Station 12" },
    client_equipment: { name: "Chaudière", brand: "Vaillant", model: "ecoTEC plus" },
    clients: { name: "Dupont Jean", email: "jean@example.be", phone: "0470 12 34 56", address_intervention: "Rue de la Station 12", postal_code: "4000", city: "Liège" },
    binome: { code: "B2", name: "Équipe Nord" },
    assigned: { full_name: "Marc Dubois" }, second: { full_name: "Luc Martin" },
  },
  profiles: { full_name: "Marc Dubois" },
};
const cfg = { company_name: "AG Chauffage", company_address: "Rue Exemple 1, 4000 Liège", company_phone: "04 000 00 00", company_email: "info@agchauffage.be", company_vat: "BE0123.456.789", document_title: "Fiche d'intervention", primary_color: "#1a1a2e", footer_text: "Merci de votre confiance" };
const doc = generateFichePdf(sheet, cfg as any, null);
writeFileSync("/tmp/pdfqa/out.pdf", Buffer.from(doc.output("arraybuffer")));
console.log("ok");
