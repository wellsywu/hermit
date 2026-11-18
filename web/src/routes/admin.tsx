import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import {
  Key,
  LayoutDashboard,
  Lock,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useSession } from '#/hooks/useSession'
import { EmptyState } from '#/components/ui/EmptyState'
import { SkeletonLines } from '#/components/SkeletonLines'
import { msg, useT } from '#/i18n'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

const ADMIN_LINKS = [
  { to: '/admin', label: msg('Overview'), Icon: LayoutDashboard, exact: true },
  { to: '/admin/skills', label: msg('Skills'), Icon: Package, exact: false },
  { to: '/admin/users', label: msg('Users'), Icon: Users, exact: false },
  {
    to: '/admin/rbac',
    label: msg('Access control'),
    Icon: ShieldCheck,
    exact: false,
  },
  { to: '/admin/auth', label: msg('Authentication'), Icon: Lock, exact: false },
  {
    to: '/admin/sync',
    label: msg('Sync sources'),
    Icon: RefreshCw,
    exact: false,
  },
] as const

// Personal access tokens are self-service, so this page is open to everyone.
const TOKENS_PATH = '/admin/tokens'

function AdminLayout() {
  const t = useT()
  const { isAdmin, isLoading } = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onTokens = pathname.replace(/\/$/, '') === TOKENS_PATH

  const body = isLoading ? (
    <div className="py-4" aria-busy="true">
      <SkeletonLines lines={6} />
    </div>
  ) : isAdmin || onTokens ? (
    <Outlet />
  ) : (
    <EmptyState
      icon={<ShieldAlert className="h-12 w-12" />}
      title={t('Admin access required')}
      description={t(
        'Your account does not have permission to open this page. Ask an administrator if you need access.',
      )}
      action={
        <Link to="/" className="btn btn-primary btn-sm">
          {t('Back to skills')}
        </Link>
      }
    />
  )

  return (
    <div className="grid gap-6 lg:gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] items-start">
      <nav
        aria-label={t('Admin')}
        className="lg:sticky lg:top-20 flex lg:flex-col gap-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0"
      >
        {isAdmin && (
          <>
            <p className="eyebrow hidden lg:block px-3 pb-1">
              {t('Administration')}
            </p>
            {ADMIN_LINKS.map(({ to, label, Icon, exact }) => (
              <Link
                key={to}
                to={to}
                className="side-link"
                activeProps={{ className: 'side-link side-link-active' }}
                activeOptions={{ exact }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(label)}
              </Link>
            ))}
          </>
        )}
        <p className="eyebrow hidden lg:block px-3 pb-1 lg:pt-4">
          {t('Personal')}
        </p>
        <Link
          to={TOKENS_PATH}
          className="side-link"
          activeProps={{ className: 'side-link side-link-active' }}
        >
          <Key className="h-4 w-4 shrink-0" />
          {t('Access tokens')}
        </Link>
      </nav>

      <div className="min-w-0">{body}</div>
    </div>
  )
}
