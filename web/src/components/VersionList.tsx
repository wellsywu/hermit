import { useState } from 'react'
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { formatDate, timeAgo } from '#/api'
import type { SkillVersionSummary } from '#/api'
import { DownloadButton } from './DownloadButton'
import { EmptyState } from './ui/EmptyState'
import { useT } from '#/i18n'

export function VersionList({
  slug,
  versions,
  latestVersion,
  currentVersion,
  onBrowse,
}: {
  slug: string
  versions: SkillVersionSummary[]
  latestVersion?: string
  /** The version currently shown on the page. */
  currentVersion?: string
  onBrowse: (version: string) => void
}) {
  const t = useT()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (versions.length === 0) {
    return <EmptyState compact title={t('No versions published yet')} />
  }

  const toggle = (version: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(version)) next.delete(version)
      else next.add(version)
      return next
    })

  return (
    <ol className="border border-base-300 rounded-box bg-base-100 divide-y divide-base-300 overflow-hidden">
      {versions.map((v) => {
        const lines = v.changelog.trim().split('\n')
        const hasMore = lines.length > 1
        const isOpen = expanded.has(v.version)
        return (
          <li
            key={v.version}
            className={`p-4 ${v.version === currentVersion ? 'bg-primary/5' : ''}`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono font-semibold">v{v.version}</span>
              {v.version === latestVersion && (
                <span className="badge badge-primary badge-sm">
                  {t('latest')}
                </span>
              )}
              {v.version === currentVersion && (
                <span className="badge badge-ghost badge-sm">
                  {t('viewing')}
                </span>
              )}
              <span
                className="text-xs text-base-content/50"
                title={formatDate(v.createdAt)}
              >
                {formatDate(v.createdAt)} · {timeAgo(v.createdAt)}
              </span>
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onBrowse(v.version)}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {t('Browse')}
                </button>
                <DownloadButton
                  slug={slug}
                  version={v.version}
                  label={t('Zip')}
                  className="btn btn-ghost btn-xs"
                />
              </span>
            </div>

            {v.changelog.trim() ? (
              <div className="mt-2 text-sm text-base-content/70">
                <p className="whitespace-pre-wrap break-words">
                  {isOpen ? v.changelog.trim() : lines[0]}
                </p>
                {hasMore && (
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    aria-expanded={isOpen}
                    onClick={() => toggle(v.version)}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {isOpen ? t('Show less') : t('Show full changelog')}
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm italic text-base-content/40">
                {t('No changelog')}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
