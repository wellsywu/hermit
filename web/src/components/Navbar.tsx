import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  KeyRound,
  Languages,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Shield,
  Sun,
  Upload,
  X,
} from 'lucide-react'
import { useTheme } from '#/hooks/useTheme'
import { useSession } from '#/hooks/useSession'
import { isLdapSubject, subjectLabel } from '#/api'
import { ChangePasswordModal } from './ChangePasswordModal'
import { LANGUAGES, msg, useLang, useT } from '#/i18n'

const themeOptions = [
  { value: 'system' as const, label: msg('System'), Icon: Monitor },
  { value: 'light' as const, label: msg('Light'), Icon: Sun },
  { value: 'dark' as const, label: msg('Dark'), Icon: Moon },
]

function blurActive() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

const navLinkClass =
  'btn btn-ghost btn-sm font-medium text-base-content/70 hover:text-base-content'
const navLinkActive = { className: `${navLinkClass} nav-active` }

export function Navbar({ onSignOut }: { onSignOut: () => void }) {
  const t = useT()
  const { mode, setMode } = useTheme()
  const { lang, setLang } = useLang()
  const { loggedIn, user, isAdmin } = useSession()
  const userName = user ? subjectLabel(user.displayName) : undefined
  // LDAP users change their password in the directory, not here.
  const canChangePassword = !!user && !isLdapSubject(user.handle)
  const ActiveIcon = themeOptions.find((o) => o.value === mode)!.Icon
  const [showChangePw, setShowChangePw] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const currentPath = useRouterState({
    select: (s) =>
      `${s.location.pathname}${s.location.searchStr}${s.location.hash}`,
  })
  const onLogin = pathname === '/login'

  useEffect(() => setMenuOpen(false), [currentPath])

  const links = (
    <>
      <Link
        to="/"
        className={navLinkClass}
        activeProps={navLinkActive}
        activeOptions={{ exact: true, includeSearch: false }}
      >
        {t('Skills')}
      </Link>
      <Link to="/publish" className={navLinkClass} activeProps={navLinkActive}>
        <Upload className="h-4 w-4" />
        {t('Publish')}
      </Link>
      {isAdmin && (
        <Link to="/admin" className={navLinkClass} activeProps={navLinkActive}>
          <Shield className="h-4 w-4" />
          {t('Administration')}
        </Link>
      )}
    </>
  )

  return (
    <>
      <header className="app-header sticky top-0 z-40 border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-lg tracking-tight shrink-0"
          >
            <img src="/hermit-crab.svg" alt="" className="h-7 w-7" />
            <span>Hermit</span>
          </Link>

          {loggedIn && !onLogin && (
            <nav className="hidden md:flex items-center gap-1 ml-2">
              {links}
            </nav>
          )}

          <div className="flex-1 flex justify-center min-w-0">
            {loggedIn && !onLogin && <SearchBox />}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-sm btn-circle"
                aria-label={t('Theme')}
              >
                <ActiveIcon className="h-4 w-4" />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 border border-base-300 rounded-box z-50 w-36 p-2 shadow-lg mt-2"
              >
                {themeOptions.map(({ value, label, Icon }) => (
                  <li key={value}>
                    <button
                      onClick={() => {
                        setMode(value)
                        blurActive()
                      }}
                      className={mode === value ? 'menu-active' : ''}
                    >
                      <Icon className="h-4 w-4" />
                      {t(label)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-sm btn-circle"
                aria-label={t('Language')}
              >
                <Languages className="h-4 w-4" />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 border border-base-300 rounded-box z-50 w-36 p-2 shadow-lg mt-2"
              >
                {LANGUAGES.map(({ value, label }) => (
                  <li key={value}>
                    <button
                      lang={value}
                      onClick={() => {
                        setLang(value)
                        blurActive()
                      }}
                      className={lang === value ? 'menu-active' : ''}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {loggedIn ? (
              <div className="dropdown dropdown-end">
                <div
                  tabIndex={0}
                  role="button"
                  className="btn btn-ghost btn-sm gap-2 px-1.5"
                  aria-label={t('Account menu')}
                >
                  <span className="h-7 w-7 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold uppercase">
                    {userName?.[0] ?? '·'}
                  </span>
                  <span className="hidden lg:inline max-w-28 truncate text-sm font-medium">
                    {userName}
                  </span>
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-100 border border-base-300 rounded-box z-50 w-52 p-2 shadow-lg mt-2"
                >
                  <li className="menu-title flex flex-row items-center gap-2 text-xs">
                    <span className="truncate">
                      {t('Signed in as')}{' '}
                      <span className="text-base-content">
                        {userName ?? '…'}
                      </span>
                    </span>
                    {isAdmin && (
                      <span className="badge badge-primary badge-xs">
                        {t('admin')}
                      </span>
                    )}
                  </li>
                  <li>
                    <Link to="/admin/tokens" onClick={blurActive}>
                      <KeyRound className="h-4 w-4" />
                      {t('Access tokens')}
                    </Link>
                  </li>
                  {canChangePassword && (
                    <li>
                      <button
                        onClick={() => {
                          setShowChangePw(true)
                          blurActive()
                        }}
                      >
                        <Lock className="h-4 w-4" />
                        {t('Change password')}
                      </button>
                    </li>
                  )}
                  <li>
                    <button onClick={onSignOut} className="text-error">
                      <LogOut className="h-4 w-4" />
                      {t('Sign out')}
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              !onLogin && (
                <Link
                  to="/login"
                  search={{ redirect: currentPath }}
                  className="btn btn-primary btn-sm"
                >
                  <LogIn className="h-4 w-4" />
                  {t('Sign in')}
                </Link>
              )
            )}

            {loggedIn && !onLogin && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle md:hidden"
                aria-label={menuOpen ? t('Close menu') : t('Open menu')}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-base-300 px-4 py-2 flex flex-col items-start gap-1">
            {links}
          </nav>
        )}
      </header>

      {showChangePw && (
        <ChangePasswordModal onClose={() => setShowChangePw(false)} />
      )}
    </>
  )
}

function SearchBox() {
  const t = useT()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const urlQuery = useRouterState({
    select: (s) =>
      s.location.pathname === '/'
        ? (((s.location.search as Record<string, unknown>).q as
            | string
            | undefined) ?? '')
        : '',
  })
  const [value, setValue] = useState(urlQuery)
  const lastPushed = useRef(urlQuery)

  // Follow the URL when it changes from elsewhere (back button, links).
  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery
      setValue(urlQuery)
    }
  }, [urlQuery])

  const go = (q: string, replace: boolean) => {
    const trimmed = q.trim()
    lastPushed.current = trimmed
    navigate({
      to: '/',
      search: (prev) => ({
        q: trimmed || undefined,
        sort: pathname === '/' ? prev.sort : undefined,
      }),
      replace,
    })
  }

  // Search as you type, but only while already on the list page.
  useEffect(() => {
    if (pathname !== '/') return
    if (value.trim() === lastPushed.current) return
    const timer = setTimeout(() => go(value, true), 300)
    return () => clearTimeout(timer)
    // `go` is recreated every render; only typing should restart the timer.
  }, [value, pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <form
      role="search"
      className="w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault()
        go(value, pathname === '/')
      }}
    >
      <label className="input input-sm w-full bg-base-100">
        <Search className="h-4 w-4 opacity-50" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (value) setValue('')
              else inputRef.current?.blur()
            }
          }}
          placeholder={t('Search skills')}
          aria-label={t('Search skills')}
          className="grow min-w-0"
        />
        <kbd className="kbd kbd-xs hidden sm:inline-flex opacity-60">/</kbd>
      </label>
    </form>
  )
}
