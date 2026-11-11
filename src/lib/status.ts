import type { AppStatus } from '../types'

export const STATUSES: { id: AppStatus; label: string; color: string }[] = [
  { id: 'draft', label: 'À préparer', color: '#64748b' },
  { id: 'ready', label: 'Prête', color: '#6366f1' },
  { id: 'sent', label: 'Envoyée', color: '#0ea5e9' },
  { id: 'interview', label: 'Entretien', color: '#f59e0b' },
  { id: 'offer', label: 'Offre', color: '#10b981' },
  { id: 'rejected', label: 'Refus', color: '#ef4444' },
  { id: 'archived', label: 'Archivée', color: '#94a3b8' },
]

export const statusOf = (id: AppStatus) => STATUSES.find((s) => s.id === id) ?? STATUSES[0]
