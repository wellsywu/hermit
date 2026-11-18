import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { api } from '#/api'
import type { APIError } from '#/api'
import { useToast } from './ui/Toast'
import { useT } from '#/i18n'

export function DownloadButton({
  slug,
  version,
  label,
  className = 'btn btn-primary btn-sm w-full',
}: {
  slug: string
  version?: string
  label?: string
  className?: string
}) {
  const t = useT()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: () => api.downloadSkill(slug, version),
    onError: (err: APIError) =>
      toast.error(t('Download failed: {error}', { error: err.message })),
  })

  return (
    <button
      type="button"
      className={className}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {label ?? t('Download zip')}
    </button>
  )
}
