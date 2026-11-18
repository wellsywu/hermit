import { createFileRoute } from '@tanstack/react-router'
import { RBACSection } from '#/components/admin/RBACSection'

export const Route = createFileRoute('/admin/rbac')({
  component: RBACSection,
})
