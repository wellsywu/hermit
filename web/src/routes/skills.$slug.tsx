import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Download, Package, SearchX, Star } from 'lucide-react'
import { APIError, api, formatDate, timeAgo } from '#/api'
import { MarkdownContent } from '#/components/MarkdownContent'
import { FileExplorer } from '#/components/FileExplorer'
import { VersionList } from '#/components/VersionList'
import { VersionCompare } from '#/components/VersionCompare'
import { SkeletonLines } from '#/components/SkeletonLines'
import { SkillAvatar } from '#/components/SkillCard'
import { DownloadButton } from '#/components/DownloadButton'
import { EmptyState } from '#/components/ui/EmptyState'
import { CommandBlock } from '#/components/ui/CopyButton'
import { findManifestPath } from '#/lib/skill-files'
import { useT } from '#/i18n'

const TABS = ['readme', 'files', 'versions', 'compare'] as const
type Tab = (typeof TABS)[number]

export const Route = createFileRoute('/skills/$slug')({
  validateSearch: (
    s: Record<string, unknown>,
  ): { tab?: Tab; v?: string; file?: string } => ({
    tab:
      TABS.includes(s.tab as Tab) && s.tab !== 'readme'
        ? (s.tab as Tab)
        : undefined,
    v: typeof s.v === 'string' && s.v ? s.v : undefined,
    file: typeof s.file === 'string' && s.file ? s.file : undefined,
  }),
  component: SkillDetailPage,
})

function SkillDetailPage() {
  const t = useT()
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const activeTab: Tab = search.tab ?? 'readme'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['skill', slug],
    queryFn: () => api.getSkill(slug),
  })

  const latest = data?.latestVersion?.version
  const version = search.v ?? latest

  const versionQuery = useQuery({
    queryKey: ['version-detail', slug, version],
    queryFn: () => api.getVersion(slug, version!),
    enabled: !!version,
  })

  const versionsQuery = useQuery({
    queryKey: ['skill-versions', slug],
    queryFn: () => api.listVersions(slug, { limit: 50 }),
  })

  const files = versionQuery.data?.version.files ?? []
  const manifestPath = findManifestPath(files.map((f) => f.path))

  const readmeQuery = useQuery({
    queryKey: ['file-content', slug, manifestPath, version],
    queryFn: () => api.getFileContent(slug, manifestPath!, version),
    enabled: !!(manifestPath && version),
  })

  if (isLoading) return <DetailSkeleton />

  if (isError || !data) {
    const notFound = error instanceof APIError && error.status === 404
    return (
      <EmptyState
        icon={<SearchX className="h-12 w-12" />}
        title={notFound ? t('Skill not found') : t('Could not load this skill')}
        description={
          notFound
            ? t('There is no skill called “{slug}” in this registry.', { slug })
            : error?.message
        }
        action={
          <div className="flex gap-2">
            {!notFound && (
              <button className="btn btn-sm" onClick={() => refetch()}>
                {t('Try again')}
              </button>
            )}
            <Link to="/" className="btn btn-primary btn-sm">
              {t('Browse skills')}
            </Link>
          </div>
        }
      />
    )
  }

  const { skill, owner } = data
  const versions = versionsQuery.data?.items ?? []
  const versionOptions = versions.some((v) => v.version === version)
    ? versions
    : version
      ? [
          {
            version,
            createdAt: versionQuery.data?.version.createdAt ?? 0,
            changelog: '',
          },
          ...versions,
        ]
      : versions
  const tags = Object.entries(skill.tags).filter(([tag]) => tag !== 'latest')
  const isLatest = version === latest
  const versionCreatedAt =
    versionQuery.data?.version.createdAt ??
    versions.find((v) => v.version === version)?.createdAt

  const setSearch = (
    patch: Partial<{
      tab: Tab
      v: string | undefined
      file: string | undefined
    }>,
    replace = true,
  ) =>
    navigate({
      search: (prev) => {
        const next = { ...prev, ...patch }
        return {
          tab: next.tab === 'readme' ? undefined : next.tab,
          v: next.v === latest ? undefined : next.v,
          file: next.file,
        }
      },
      replace,
      resetScroll: false,
    })

  const tabLabels: Record<Tab, string> = {
    readme: t('Readme'),
    files: files.length
      ? t('Files ({count})', { count: files.length })
      : t('Files'),
    versions: versions.length
      ? t('Versions ({count})', { count: versions.length })
      : t('Versions'),
    compare: t('Compare'),
  }

  return (
    <div className="space-y-6 pb-12">
      <nav
        aria-label={t('Breadcrumb')}
        className="flex items-center gap-1 text-sm text-base-content/50"
      >
        <Link to="/" className="hover:text-base-content">
          {t('Skills')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-mono text-base-content/80 truncate">{slug}</span>
      </nav>

      <header className="flex items-start gap-4">
        <SkillAvatar slug={skill.slug} name={skill.displayName} size="lg" />
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight break-words">
            {skill.displayName}
          </h1>
          {skill.summary && (
            <p className="text-base-content/70 max-w-prose">{skill.summary}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/50">
            {owner && (
              <>
                {owner.image ? (
                  <img
                    src={owner.image}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-primary/15 grid place-items-center text-[10px] font-bold text-primary uppercase">
                    {owner.displayName[0]}
                  </span>
                )}
                <span className="font-medium text-base-content/70">
                  {owner.displayName}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>
              {t('Updated')} {timeAgo(skill.updatedAt)}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        {/* Main column */}
        <div className="min-w-0 order-last lg:order-first">
          {!isLatest && version && (
            <div className="alert alert-warning alert-soft text-sm py-2 mb-4">
              <span>
                {t('You are viewing')}{' '}
                <strong className="font-mono">v{version}</strong>
                {t(', not the latest version.')}
              </span>
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => setSearch({ v: undefined, file: undefined })}
              >
                {t('Go to latest')}
              </button>
            </div>
          )}

          <div role="tablist" className="tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setSearch({ tab }, false)}
                className={`tab-item ${activeTab === tab ? 'tab-item-active' : ''}`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {activeTab === 'readme' &&
              (versionQuery.isLoading || readmeQuery.isLoading ? (
                <SkeletonLines lines={8} />
              ) : readmeQuery.data ? (
                <article className="rounded-box border border-base-300 bg-base-100 p-5 sm:p-8">
                  <MarkdownContent content={readmeQuery.data} stripHeading />
                </article>
              ) : (
                <EmptyState
                  compact
                  title={t('No readme')}
                  description={
                    version
                      ? t('This version does not include a SKILL.md file.')
                      : t('Nothing has been published for this skill yet.')
                  }
                />
              ))}

            {activeTab === 'files' &&
              (versionQuery.isLoading ? (
                <SkeletonLines lines={8} />
              ) : files.length > 0 && version ? (
                <FileExplorer
                  slug={slug}
                  version={version}
                  files={files}
                  selected={search.file}
                  onSelect={(file) => setSearch({ file })}
                />
              ) : (
                <EmptyState compact title={t('No files in this version')} />
              ))}

            {activeTab === 'versions' &&
              (versionsQuery.isLoading ? (
                <SkeletonLines lines={6} />
              ) : (
                <VersionList
                  slug={slug}
                  versions={versions}
                  latestVersion={latest}
                  currentVersion={version}
                  onBrowse={(v) =>
                    setSearch({ v, tab: 'files', file: undefined }, false)
                  }
                />
              ))}

            {activeTab === 'compare' && (
              <VersionCompare
                slug={slug}
                versions={versions}
                latestVersion={latest}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
          {version ? (
            <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="version-select" className="eyebrow block">
                  {t('Version')}
                </label>
                <select
                  id="version-select"
                  className="select select-sm w-full font-mono"
                  value={version}
                  onChange={(e) =>
                    setSearch({ v: e.target.value, file: undefined }, false)
                  }
                >
                  {versionOptions.map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version}
                      {v.version === latest ? t(' (latest)') : ''}
                    </option>
                  ))}
                </select>
                {versionCreatedAt ? (
                  <p className="text-xs text-base-content/50">
                    {t('Published')} {formatDate(versionCreatedAt)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <p className="eyebrow">{t('Install with the CLI')}</p>
                <CommandBlock
                  lines={[
                    `clawhub install --registry ${window.location.origin} ${slug}${
                      isLatest ? '' : ` --version ${version}`
                    }`,
                  ]}
                />
              </div>

              <DownloadButton
                slug={slug}
                version={version}
                className="btn btn-sm w-full"
              />
            </div>
          ) : (
            <div className="rounded-box border border-base-300 bg-base-100 p-4 text-sm text-base-content/60">
              {t('No version has been published yet.')}
            </div>
          )}

          <dl className="rounded-box border border-base-300 bg-base-100 p-4 space-y-2.5 text-sm">
            <StatRow
              icon={<Download className="h-4 w-4" />}
              label={t('Downloads')}
              value={skill.stats.downloads}
            />
            <StatRow
              icon={<Star className="h-4 w-4" />}
              label={t('Stars')}
              value={skill.stats.stars}
            />
            <StatRow
              icon={<Package className="h-4 w-4" />}
              label={t('Current installs')}
              value={skill.stats.installsCurrent}
            />
            <StatRow
              icon={<Package className="h-4 w-4" />}
              label={t('All-time installs')}
              value={skill.stats.installsAllTime}
            />
          </dl>

          {tags.length > 0 && (
            <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-2">
              <p className="eyebrow">{t('Tags')}</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(([tag, tagVersion]) => (
                  <button
                    key={tag}
                    type="button"
                    className="badge badge-ghost font-mono text-xs hover:badge-primary cursor-pointer"
                    title={t('Switch to v{version}', { version: tagVersion })}
                    onClick={() =>
                      setSearch({ v: tagVersion, file: undefined }, false)
                    }
                  >
                    {tag} → {tagVersion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2 text-base-content/60">
      {icon}
      <dt className="flex-1">{label}</dt>
      <dd className="font-semibold text-base-content tabular-nums">
        {value.toLocaleString()}
      </dd>
    </div>
  )
}

function DetailSkeleton() {
  const t = useT()
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t('Loading skill')}>
      <div className="skeleton h-4 w-40" />
      <div className="flex items-start gap-4">
        <div className="skeleton h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-8 w-1/3" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          <div className="skeleton h-10 w-full" />
          <SkeletonLines lines={8} />
        </div>
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  )
}
