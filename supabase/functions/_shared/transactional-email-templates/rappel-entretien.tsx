/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  equipmentName?: string
  energyType?: string
  interventionType?: string
  dueDate?: string
  contactPhone?: string
  contactEmail?: string
  customSubject?: string
  introText?: string
  footerText?: string
}

const Email = ({
  clientName = 'Client',
  equipmentName = '',
  energyType = '',
  interventionType = 'Entretien',
  dueDate = '',
  contactPhone = '',
  contactEmail = 'info@agchauffage.be',
  introText = "Nous vous contactons pour convenir d'une date pour votre prochain entretien. Merci de nous répondre à cet email ou de nous téléphoner afin de fixer un rendez-vous.",
  footerText = 'Merci de votre confiance,\nAG Chauffage',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Il est temps de planifier votre entretien</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre entretien annuel</Heading>
        <Text style={text}>Bonjour {clientName},</Text>
        <Text style={{ ...text, whiteSpace: 'pre-wrap' }}>{introText}</Text>

        <Section style={card}>
          <Text style={row}><strong>Type&nbsp;:</strong> {interventionType}</Text>
          {equipmentName && <Text style={row}><strong>Équipement&nbsp;:</strong> {equipmentName}</Text>}
          {energyType && <Text style={row}><strong>Énergie&nbsp;:</strong> {energyType}</Text>}
          {dueDate && <Text style={row}><strong>Échéance conseillée&nbsp;:</strong> {dueDate}</Text>}
        </Section>

        <Section style={card}>
          <Text style={label}>Nous contacter</Text>
          {contactPhone && <Text style={row}>📞 {contactPhone}</Text>}
          <Text style={row}>✉️ {contactEmail}</Text>
        </Section>

        <Hr style={hr} />
        <Text style={{ ...footer, whiteSpace: 'pre-wrap' }}>{footerText}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    data?.customSubject?.trim() ||
    `Votre entretien AG Chauffage — planifions un rendez-vous`,
  displayName: "Rappel d'entretien (client)",
  previewData: {
    clientName: 'Dupont Jean',
    equipmentName: 'Chaudière Vaillant',
    energyType: 'Gaz',
    interventionType: 'Entretien annuel',
    dueDate: '15/09/2026',
    contactPhone: '+32 4 000 00 00',
    contactEmail: 'info@agchauffage.be',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: 'hsl(220, 30%, 12%)', fontSize: '24px', fontWeight: 700, margin: '0 0 16px' }
const text = { color: 'hsl(220, 30%, 12%)', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px' }
const card = { backgroundColor: 'hsl(220, 20%, 97%)', borderRadius: '12px', padding: '16px 18px', margin: '12px 0' }
const row = { color: 'hsl(220, 30%, 12%)', fontSize: '14px', margin: '4px 0' }
const label = { color: 'hsl(220, 10%, 46%)', fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px' }
const hr = { borderColor: 'hsl(220, 13%, 88%)', margin: '24px 0' }
const footer = { color: 'hsl(220, 10%, 46%)', fontSize: '12px', margin: 0 }