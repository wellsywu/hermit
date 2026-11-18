import { createFileRoute } from '@tanstack/react-router'
import { AuthConfigSection } from '#/components/admin/AuthConfigSection'

export const Route = createFileRoute('/admin/auth')({
  component: AuthConfigSection,
})
