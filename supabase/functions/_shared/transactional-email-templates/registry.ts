/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { template as ficheIntervention } from './fiche-intervention.tsx'
import { template as rappelEntretien } from './rappel-entretien.tsx'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'fiche-intervention': ficheIntervention,
  'rappel-entretien': rappelEntretien,
}