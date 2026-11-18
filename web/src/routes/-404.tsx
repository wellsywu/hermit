import { Link } from '@tanstack/react-router'
import { EmptyState } from '#/components/ui/EmptyState'
import { useT } from '#/i18n'

export function NotFoundComponent() {
  const t = useT()
  return (
    <EmptyState
      title={t('Page not found')}
      description={t('This page does not exist, or it has moved.')}
      action={
        <Link to="/" className="btn btn-primary btn-sm">
          {t('Back to skills')}
        </Link>
      }
    />
  )
}
