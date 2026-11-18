import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useCallback } from 'react'
import { useToken } from '#/hooks/useSession'

import '../styles.css'
import TanStackQueryProvider from '../integrations/tanstack-query/root-provider'
import { ThemeProvider } from '#/hooks/useTheme'
import {
  setToken as saveToken,
  clearToken as removeToken,
  onUnauthorized,
} from '#/api'
import { Navbar } from '#/components/Navbar'
import { ToastProvider } from '#/components/ui/Toast'
import { ConfirmProvider } from '#/components/ui/ConfirmDialog'
import { NotFoundComponent } from './-404'

import type { QueryClient } from '@tanstack/react-query'
import { I18nProvider, useT } from '#/i18n'

interface MyRouterContext {
  queryClient: QueryClient
}

function getCurrentPath(): string {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
})

function RootComponent() {
  const navigate = useNavigate()
  const { queryClient } = Route.useRouteContext()

  const handleLogout = useCallback(() => {
    removeToken()
    queryClient.clear()
    navigate({ to: '/login', replace: true })
  }, [navigate, queryClient])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authToken = params.get('auth_token')
    if (authToken) {
      saveToken(authToken)
      const url = new URL(window.location.href)
      url.searchParams.delete('auth_token')
      url.searchParams.delete('auth_subject')
      url.searchParams.delete('auth_name')
      window.history.replaceState({}, '', url.pathname)
      navigate({ to: '/' })
    }
    const authError = params.get('auth_error')
    if (authError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('auth_error')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [navigate])

  // Every API call needs a token, so send signed-out visitors straight to
  // the login page instead of letting each page fail on its own.
  const token = useToken()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    const hasCallbackToken = new URLSearchParams(window.location.search).has(
      'auth_token',
    )
    if (!token && pathname !== '/login' && !hasCallbackToken) {
      navigate({
        to: '/login',
        search: { redirect: getCurrentPath() },
        replace: true,
      })
    }
  }, [token, pathname, navigate])

  useEffect(
    () =>
      onUnauthorized(() => {
        queryClient.clear()
        navigate({
          to: '/login',
          search: { redirect: getCurrentPath() },
          replace: true,
        })
      }),
    [navigate, queryClient],
  )

  return (
    <ThemeProvider>
      <I18nProvider>
        <TanStackQueryProvider>
          <ToastProvider>
            <ConfirmProvider>
              <div className="min-h-screen flex flex-col bg-base-200/40">
                <Navbar onSignOut={handleLogout} />
                <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
                  <Outlet />
                </main>
                <Footer />
              </div>
            </ConfirmProvider>
          </ToastProvider>
        </TanStackQueryProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

function Footer() {
  const t = useT()
  return (
    <footer className="border-t border-base-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-base-content/50">
        <span>{t('Hermit — private skill registry')}</span>
        <span className="flex items-center gap-4">
          <a
            href="/.well-known/clawhub.json"
            className="hover:text-base-content"
            target="_blank"
            rel="noreferrer"
          >
            {t('Registry discovery')}
          </a>
          <a
            href="/healthz"
            className="hover:text-base-content"
            target="_blank"
            rel="noreferrer"
          >
            {t('Health')}
          </a>
        </span>
      </div>
    </footer>
  )
}
