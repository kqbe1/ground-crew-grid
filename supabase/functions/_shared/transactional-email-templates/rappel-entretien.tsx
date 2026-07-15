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
  clientPhone?: string
  clientEmail?: string
  clientAddress?: string
  clientCity?: string
  equipmentName?: string
  energyType?: string
  interventionType?: string
  dueDate?: string
  notes?: string
}

const Email = ({
  clientName = 'Client',
  clientPhone = '',
  clientEmail = '',
  clientAddress = '',
  clientCity = '',
  equipmentName = '',
  energyType = '',
  interventionType = 'Entretien',
  dueDate = '',
  notes = '',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Entretien à planifier — {clientName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Entretien à planifier</Heading>
        <Text style={text}>Bonjour,</Text>
        <Text style={text}>
          Un entretien doit être planifié pour le client ci-dessous.
        </Text>

        <Section style={card}>
          <Text style={row}><strong>Client&nbsp;:</strong> {clientName}</Text>
          {(clientAddress || clientCity) && (
            <Text style={row}><strong>Adresse&nbsp;:</strong> {[clientAddress, clientCity].filter(Boolean).join(', ')}</Text>
          )}
          {clientPhone && <Text style={row}><strong>Téléphone&nbsp;:</strong> {clientPhone}</Text>}
          {clientEmail && <Text style={row}><strong>Email&nbsp;:</strong> {clientEmail}</Text>}
        </Section>

        <Section style={card}>
          <Text style={row}><strong>Type&nbsp;:</strong> {interventionType}</Text>
          {equipmentName && <Text style={row}><strong>Équipement&nbsp;:</strong> {equipmentName}</Text>}
          {energyType && <Text style={row}><strong>Énergie&nbsp;:</strong> {energyType}</Text>}
          {dueDate && <Text style={row}><strong>Échéance&nbsp;:</strong> {dueDate}</Text>}
        </Section>

        {notes && (
          <Section style={card}>
            <Text style={label}>Notes</Text>
            <Text style={{ ...text, whiteSpace: 'pre-wrap' }}>{notes}</Text>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>AG Chauffage — Rappel transmis automatiquement.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `Entretien à planifier — ${data?.clientName ?? 'Client'}`,
  displayName: "Rappel d'entretien à planifier",
  to: 'info@agchauffage.be',
  previewData: {
    clientName: 'Dupont Jean',
    clientPhone: '0475 12 34 56',
    clientEmail: 'jean@example.com',
    clientAddress: 'Rue de la Paix 12',
    clientCity: '5000 Namur',
    equipmentName: 'Chaudière Vaillant',
    energyType: 'Gaz',
    interventionType: 'Entretien annuel',
    dueDate: '15/09/2026',
    notes: 'Contrat annuel — client à recontacter.',
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