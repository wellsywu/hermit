import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { RotateCcw, Search, Trash2 } from 'lucide-react'
import { api, timeAgo } from '#/api'
import type { APIError } from '#/api'
import { PageHeader } from '#/components/ui/PageHeader'
import { EmptyState } from '#/components/ui/EmptyState'
import { useToast } from '#/components/ui/Toast'
import { useConfirm } from '#/components/ui/ConfirmDialog'
import { useT } from '#/i18n'

export const Route = createFileRoute('/admin/skills')({
  component: SkillManagementPage,
})

function SkillManagementPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [filter, setFilter] = useState('')
  const [restoreSlug, setRestoreSlug] = useState('')

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin-skills'],
    queryFn: ({ pageParam }) =>
      api.listSkills({ sort: 'updated', limit: 50, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-skills'] })
    queryClient.invalidateQueries({ queryKey: ['skills'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => api.deleteSkill(slug),
    onSuccess: (_data, slug) => {
      toast.success(
        t('Deleted “{slug}”. Restore it below if this was a mistake.', {
          slug,
        }),
      )
      setRestoreSlug(slug)
      refresh()
    },
    onError: (err: APIError) => toast.error(err.message),
  })

  const restoreMutation = useMutation({
    mutationFn: (slug: string) => api.undeleteSkill(slug),
    onSuccess: (_data, slug) => {
      toast.success(t('Restored “{slug}”', { slug }))
      setRestoreSlug('')
      refresh()
    },
    onError: (err: APIError) => toast.error(err.message),
  })

  const all = data?.pages.flatMap((p) => p.items) ?? []
  const needle = filter.trim().toLowerCase()
  const skills = needle
    ? all.filter(
        (s) =>
          s.slug.toLowerCase().includes(needle) ||
          s.displayName.toLowerCase().includes(needle),
      )
    : all

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Skills')}
        description={t(
          'Delete skills from the catalog, or restore ones removed earlier',
        )}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="input input-sm w-full sm:w-72">
          <Search className="h-4 w-4 opacity-50" />
          <input
            type="search"
            placeholder={t('Filter loaded skills')}
            aria-label={t('Filter loaded skills')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>

        <form
          className="join ml-auto"
          onSubmit={(e) => {
            e.preventDefault()
            const slug = restoreSlug.trim()
            if (slug) restoreMutation.mutate(slug)
          }}
        >
          <input
            type="text"
            placeholder={t('Slug of a deleted skill')}
            aria-label={t('Slug of a deleted skill')}
            className="input input-sm join-item font-mono w-56"
            value={restoreSlug}
            onChange={(e) => setRestoreSlug(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-sm join-item"
            disabled={!restoreSlug.trim() || restoreMutation.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('Restore')}
          </button>
        </form>
      </div>

      {isError ? (
        <div className="alert alert-error">
          {t('Could not load skills:')} {error.message}
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-12 w-full" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <EmptyState
          compact
          title={needle ? t('No skills match this filter') : t('No skills yet')}
        />
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Skill')}</th>
                <th>{t('Latest')}</th>
                <th className="text-right">{t('Downloads')}</th>
                <th>{t('Updated')}</th>
                <th>
                  <span className="sr-only">{t('Actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.slug} className="hover:bg-base-200/50">
                  <td className="max-w-md">
                    <Link
                      to="/skills/$slug"
                      params={{ slug: skill.slug }}
                      className="font-semibold hover:text-primary"
                    >
                      {skill.displayName}
                    </Link>
                    <div className="font-mono text-xs text-base-content/50">
                      {skill.slug}
                    </div>
                  </td>
                  <td className="font-mono text-xs">
                    {skill.latestVersion
                      ? `v${skill.latestVersion.version}`
                      : '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {skill.stats.downloads.toLocaleString()}
                  </td>
                  <td className="text-sm text-base-content/60 whitespace-nowrap">
                    {timeAgo(skill.updatedAt)}
                  </td>
                  <td className="text-right">
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      disabled={deleteMutation.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: t('Delete “{name}”?', {
                            name: skill.displayName,
                          }),
                          message: (
                            <>
                              <span className="font-mono">{skill.slug}</span>{' '}
                              {t(
                                'will disappear from the catalog and can no longer be installed. You can restore it later by slug.',
                              )}
                            </>
                          ),
                          confirmLabel: t('Delete skill'),
                          danger: true,
                        })
                        if (ok) deleteMutation.mutate(skill.slug)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage && (
        <div className="text-center">
          <button
            className="btn btn-sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage && (
              <span className="loading loading-spinner loading-xs" />
            )}
            {t('Load more')}
          </button>
        </div>
      )}
    </div>
  )
}
