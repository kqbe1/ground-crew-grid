/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  clientCity?: string
  taskTitle?: string
  interventionDate?: string
  workerName?: string
  finalStatus?: string
  description?: string
  pdfUrl?: string
  customSubject?: string
  introText?: string
  footerText?: string
}

const Email = ({
  clientName = 'Client',
  clientCity = '',
  taskTitle = 'Intervention',
  interventionDate = '',
  workerName = '',
  finalStatus = '',
  description = '',
  pdfUrl = '',
  introText = "Suite à notre intervention, veuillez trouver ci-dessous le récapitulatif ainsi que la fiche d'intervention en pièce jointe (lien PDF).",
  footerText = 'Merci de votre confiance,\nAG Chauffage',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre fiche d'intervention AG Chauffage</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre fiche d'intervention</Heading>
        <Text style={text}>Bonjour {clientName},</Text>
        <Text style={{ ...text, whiteSpace: 'pre-wrap' }}>{introText}</Text>

        <Section style={card}>
          <Text style={row}><strong>Intervention&nbsp;:</strong> {taskTitle}</Text>
          {interventionDate && <Text style={row}><strong>Date&nbsp;:</strong> {interventionDate}</Text>}
          {workerName && <Text style={row}><strong>Technicien&nbsp;:</strong> {workerName}</Text>}
          {finalStatus && <Text style={row}><strong>Statut&nbsp;:</strong> {finalStatus}</Text>}
        </Section>

        {description && (
          <Section style={card}>
            <Text style={label}>Description</Text>
            <Text style={{ ...text, whiteSpace: 'pre-wrap' }}>{description}</Text>
          </Section>
        )}

        {pdfUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Link href={pdfUrl} style={button}>
              Télécharger la fiche PDF
            </Link>
            <Text style={hint}>Le lien reste valide 7 jours.</Text>
          </Section>
        )}

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
    `Votre fiche d'intervention AG Chauffage${data?.interventionDate ? ` — ${data.interventionDate}` : ''}`,
  displayName: "Fiche d'intervention (client)",
  previewData: {
    clientName: 'Dupont Jean',
    clientCity: 'Namur',
    taskTitle: 'Entretien chaudière gaz',
    interventionDate: '15/07/2026',
    workerName: 'Marc L.',
    finalStatus: 'Terminé',
    description: 'Entretien annuel effectué. Chaudière en bon état.',
    pdfUrl: 'https://example.com/fiche.pdf',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: 'hsl(220, 30%, 12%)', fontSize: '24px', fontWeight: 700, margin: '0 0 16px' }
const text = { color: 'hsl(220, 30%, 12%)', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px' }
const card = { backgroundColor: 'hsl(220, 20%, 97%)', borderRadius: '12px', padding: '16px 18px', margin: '16px 0' }
const row = { color: 'hsl(220, 30%, 12%)', fontSize: '14px', margin: '4px 0' }
const label = { color: 'hsl(220, 10%, 46%)', fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px' }
const button = {
  backgroundColor: 'hsl(220, 72%, 50%)',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '12px',
  textDecoration: 'none',
  fontWeight: 600,
  display: 'inline-block',
  fontSize: '15px',
}
const hint = { color: 'hsl(220, 10%, 46%)', fontSize: '12px', margin: '10px 0 0' }
const hr = { borderColor: 'hsl(220, 13%, 88%)', margin: '24px 0' }
const footer = { color: 'hsl(220, 10%, 46%)', fontSize: '12px', margin: 0 }