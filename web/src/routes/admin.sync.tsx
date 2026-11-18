import { createFileRoute } from '@tanstack/react-router'
import { SyncSection } from '#/components/admin/SyncSection'

export const Route = createFileRoute('/admin/sync')({
  component: SyncSection,
})
