import { useState, useEffect, useRef, useCallback } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Download,
  KeyRound,
  Layers,
  Package,
  SearchX,
  Upload,
  X,
} from 'lucide-react'
import { api } from '#/api'
import { useSession } from '#/hooks/useSession'
import { SkillCard, SkillCardSkeleton } from '#/components/SkillCard'
import { EmptyState } from '#/components/ui/EmptyState'
import { CommandBlock } from '#/components/ui/CopyButton'
import { msg, useT } from '#/i18n'

const SORTS = [
  { value: 'updated', label: msg('Recently updated') },
  { value: 'downloads', label: msg('Most downloaded') },
  { value: 'stars', label: msg('Most starred') },
  { value: 'installsCurrent', label: msg('Most installed') },
] as const

type SortValue = (typeof SORTS)[number]['value']

function parseSort(value: unknown): SortValue | undefined {
  const found = SORTS.find((s) => s.value === value)
  return found && found.value !== 'updated' ? found.value : undefined
}

export const Route = createFileRoute('/')({
  validateSearch: (
    s: Record<string, unknown>,
  ): { q?: string; sort?: SortValue } => ({
    q: typeof s.q === 'string' && s.q.trim() ? s.q : undefined,
    sort: parseSort(s.sort),
  }),
  component: HomePage,
})

const gridClass = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'

function HomePage() {
  const { q, sort } = Route.useSearch()
  return (
    <div className="space-y-8">
      {!q && <GettingStarted />}
      {q ? <SearchResults query={q} /> : <SkillList sort={sort ?? 'updated'} />}
    </div>
  )
}

/* ---- Getting started banner ---- */

const BANNER_KEY = 'hermit-hide-getting-started'

function GettingStarted() {
  const t = useT()
  const { isAdmin } = useSession()
  const [hidden, setHidden] = useState(
    () => localStorage.getItem(BANNER_KEY) === '1',
  )
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.getDashboardStats(),
    enabled: isAdmin,
    staleTime: 60_000,
  })

  if (hidden) return null

  const origin = window.location.origin

  return (
    <section className="hero-panel relative rounded-box border border-base-300 p-6 sm:p-8">
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle absolute top-3 right-3"
        aria-label={t('Hide getting started')}
        title={t('Hide')}
        onClick={() => {
          localStorage.setItem(BANNER_KEY, '1')
          setHidden(true)
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            {t("Your team's private skill registry")}
          </h1>
          <p className="text-base-content/70 max-w-prose">
            {t(
              'Publish, proxy and discover AI agent skills behind your own infrastructure. Works with any ClawHub-compatible CLI.',
            )}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to="/publish" className="btn btn-primary btn-sm">
              <Upload className="h-4 w-4" />
              {t('Publish a skill')}
            </Link>
            <Link to="/admin/tokens" className="btn btn-sm">
              <KeyRound className="h-4 w-4" />
              {t('Get an access token')}
            </Link>
          </div>
          {stats && (
            <dl className="flex flex-wrap gap-x-6 gap-y-2 pt-3 text-sm">
              <Stat
                icon={<Package className="h-4 w-4" />}
                label={t('skills')}
                value={stats.totalSkills}
              />
              <Stat
                icon={<Layers className="h-4 w-4" />}
                label={t('versions')}
                value={stats.totalVersions}
              />
              <Stat
                icon={<Download className="h-4 w-4" />}
                label={t('downloads')}
                value={stats.totalDownloads}
              />
            </dl>
          )}
        </div>

        <div className="space-y-2 min-w-0">
          <p className="eyebrow">{t('Connect your CLI')}</p>
          <CommandBlock
            lines={[
              `export CLAWHUB_REGISTRY=${origin}`,
              'clawhub login --token <your-token>',
              'clawhub install <skill>',
            ]}
          />
          <p className="text-xs text-base-content/50">
            {t('Replace')} <code className="font-mono">&lt;your-token&gt;</code>{' '}
            {t('with a personal access token.')}
          </p>
        </div>
      </div>
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-1.5 text-base-content/60">
      {icon}
      <dd className="font-semibold text-base-content tabular-nums">
        {value.toLocaleString()}
      </dd>
      <dt>{label}</dt>
    </div>
  )
}

/* ---- Browse ---- */

function SkillList({ sort }: { sort: SortValue }) {
  const t = useT()
  const navigate = useNavigate({ from: '/' })

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['skills', sort],
    queryFn: ({ pageParam }) =>
      api.listSkills({ sort, limit: 24, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: '200px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleIntersect])

  const skills = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">{t('Skills')}</h2>
        <div
          className="join overflow-x-auto max-w-full"
          role="group"
          aria-label={t('Sort skills')}
        >
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sort === option.value}
              className={`btn btn-sm join-item whitespace-nowrap ${
                sort === option.value ? 'btn-active' : ''
              }`}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    sort: parseSort(option.value),
                  }),
                  replace: true,
                })
              }
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <LoadError message={error.message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 6 }, (_, i) => (
            <SkillCardSkeleton key={i} />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <EmptyState
          title={t('No skills yet')}
          description={t(
            'Publish your first skill, or ask an admin to sync an upstream registry.',
          )}
          action={
            <Link to="/publish" className="btn btn-primary btn-sm">
              <Upload className="h-4 w-4" />
              {t('Publish a skill')}
            </Link>
          }
        />
      ) : (
        <div className={gridClass}>
          {skills.map((skill) => (
            <SkillCard
              key={skill.slug}
              skill={{ ...skill, version: skill.latestVersion?.version }}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="py-2 text-center min-h-6">
        {isFetchingNextPage && (
          <span className="loading loading-dots loading-sm text-base-content/40" />
        )}
        {!isLoading && !hasNextPage && skills.length > 24 && (
          <p className="text-xs text-base-content/40">
            {t("That's all")} {skills.length} {t('skills')}
          </p>
        )}
      </div>
    </section>
  )
}

/* ---- Search ---- */

function SearchResults({ query }: { query: string }) {
  const t = useT()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.searchSkills(query),
    placeholderData: (prev) => prev,
  })

  const results = data?.results ?? []

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          {t('Results for')} <span className="text-primary">“{query}”</span>
        </h1>
        <div className="flex items-center gap-3 text-sm text-base-content/60">
          {data && (
            <span>
              {results.length} {results.length === 1 ? t('skill') : t('skills')}
            </span>
          )}
          <Link to="/" className="link link-hover">
            {t('Clear search')}
          </Link>
        </div>
      </div>

      {isError ? (
        <LoadError message={error.message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 3 }, (_, i) => (
            <SkillCardSkeleton key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-12 w-12" />}
          title={t('No skills match your search')}
          description={t(
            'Try a shorter or different keyword. Search covers names, slugs and summaries.',
          )}
          action={
            <Link to="/" className="btn btn-sm">
              {t('Browse all skills')}
            </Link>
          }
        />
      ) : (
        <div className={gridClass}>
          {results.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} />
          ))}
        </div>
      )}
    </section>
  )
}

function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const t = useT()
  return (
    <div className="alert alert-error">
      <AlertCircle className="h-4 w-4" />
      <span>
        {t('Could not load skills:')} {message}
      </span>
      <button type="button" className="btn btn-sm" onClick={onRetry}>
        {t('Try again')}
      </button>
    </div>
  )
}
