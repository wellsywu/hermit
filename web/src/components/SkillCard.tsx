import { Link } from '@tanstack/react-router'
import { Download, Star } from 'lucide-react'
import { timeAgo } from '#/api'
import type { SkillStats } from '#/api'
import { getLang, useT } from '#/i18n'

export interface SkillCardData {
  slug: string
  displayName: string
  summary: string | null
  version?: string | null
  stats?: SkillStats
  updatedAt?: number | null
}

function hueFor(slug: string): number {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 360
}

export function SkillAvatar({
  slug,
  name,
  size = 'md',
}: {
  slug: string
  name: string
  size?: 'md' | 'lg'
}) {
  const hue = hueFor(slug)
  const letter = (name.trim() || slug || '?').charAt(0).toUpperCase()
  return (
    <div
      aria-hidden
      className={`skill-avatar shrink-0 grid place-items-center font-bold ${
        size === 'lg'
          ? 'h-14 w-14 text-2xl rounded-2xl'
          : 'h-10 w-10 text-base rounded-xl'
      }`}
      style={{ '--avatar-hue': hue } as React.CSSProperties}
    >
      {letter}
    </div>
  )
}

function compact(n: number): string {
  return new Intl.NumberFormat(getLang() === 'zh' ? 'zh-CN' : 'en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

export function SkillCard({ skill }: { skill: SkillCardData }) {
  const t = useT()
  return (
    <Link
      to="/skills/$slug"
      params={{ slug: skill.slug }}
      className="skill-card group flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4 h-full"
    >
      <div className="flex items-start gap-3">
        <SkillAvatar slug={skill.slug} name={skill.displayName} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug truncate group-hover:text-primary transition-colors">
            {skill.displayName}
          </h3>
          <p className="font-mono text-xs text-base-content/50 truncate">
            {skill.slug}
          </p>
        </div>
        {skill.version && (
          <span className="badge badge-ghost badge-sm font-mono shrink-0">
            v{skill.version}
          </span>
        )}
      </div>

      <p className="text-sm text-base-content/70 line-clamp-2 flex-1">
        {skill.summary || (
          <span className="italic text-base-content/40">
            {t('No description')}
          </span>
        )}
      </p>

      <div className="flex items-center gap-4 text-xs text-base-content/50">
        {skill.stats && (
          <>
            <span
              className="flex items-center gap-1"
              title={t('{count} downloads', {
                count: skill.stats.downloads.toLocaleString(),
              })}
            >
              <Download className="h-3.5 w-3.5" />
              {compact(skill.stats.downloads)}
            </span>
            <span
              className="flex items-center gap-1"
              title={t('{count} stars', {
                count: skill.stats.stars.toLocaleString(),
              })}
            >
              <Star className="h-3.5 w-3.5" />
              {compact(skill.stats.stars)}
            </span>
          </>
        )}
        {skill.updatedAt ? (
          <span className="ml-auto">
            {t('Updated')} {timeAgo(skill.updatedAt)}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

export function SkillCardSkeleton() {
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-4/5" />
      <div className="skeleton h-3 w-1/2 mt-1" />
    </div>
  )
}
