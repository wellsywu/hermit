import { createFileRoute } from '@tanstack/react-router'
import { StatsSection } from '#/components/admin/StatsSection'
import { PageHeader } from '#/components/ui/PageHeader'
import { useT } from '#/i18n'

export const Route = createFileRoute('/admin/')({
  component: AdminIndexPage,
})

function AdminIndexPage() {
  const t = useT()
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Overview')}
        description={t(
          'Registry totals and repository status. Refreshes every 30 seconds.',
        )}
      />
      <StatsSection />
    </div>
  )
}
