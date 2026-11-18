import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Key,
  Clock,
  AlertCircle,
  Terminal,
  ShieldAlert,
  KeyRound,
} from 'lucide-react'
import { api, DEFAULT_TOKEN_EXPIRY_DAYS, TOKEN_EXPIRY_DAYS } from '#/api'
import type { APIError, PersonalAccessToken } from '#/api'
import { PageHeader } from '#/components/ui/PageHeader'
import { useToast } from '#/components/ui/Toast'
import { useConfirm } from '#/components/ui/ConfirmDialog'
import { CommandBlock } from '#/components/ui/CopyButton'
import { useT } from '#/i18n'

export const Route = createFileRoute('/admin/tokens')({
  component: TokenManagementPage,
})

function TokenExpiry({ expiresAt }: { expiresAt: string | null }) {
  const t = useT()
  if (!expiresAt) {
    return <span>{t('No expiration')}</span>
  }
  const date = new Date(expiresAt)
  if (date.getTime() <= Date.now()) {
    return <span className="badge badge-error badge-xs">{t('Expired')}</span>
  }
  return (
    <span>
      {t('Expires')} {date.toLocaleDateString()}
    </span>
  )
}

function TokenManagementPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [expiryDays, setExpiryDays] = useState<number>(
    DEFAULT_TOKEN_EXPIRY_DAYS,
  )
  const [createdToken, setCreatedToken] = useState<{
    token: string
    name: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tokensQuery = useQuery({
    queryKey: ['my-tokens'],
    queryFn: () => api.listMyTokens(),
  })

  const createMutation = useMutation({
    mutationFn: (tokenName: string) => api.createMyToken(tokenName, expiryDays),
    onSuccess: (result) => {
      setCreatedToken({ token: result.token, name: result.name })
      setName('')
      setExpiryDays(DEFAULT_TOKEN_EXPIRY_DAYS)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['my-tokens'] })
    },
    onError: (err: APIError) => {
      setError(err.message)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => api.revokeMyToken(tokenId),
    onSuccess: () => {
      toast.success(t('Token revoked'))
      queryClient.invalidateQueries({ queryKey: ['my-tokens'] })
    },
    onError: (err: APIError) => toast.error(err.message),
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const tokens = tokensQuery.data?.tokens ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Access tokens')}
        description={t('Personal access tokens for the Hermit API and CLI')}
      />

      {/* Newly created token — prominent banner */}
      {createdToken && (
        <div className="alert alert-success shadow-lg">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-2 font-semibold">
              <Check className="h-5 w-5 shrink-0" />
              {t('Token “')}
              {createdToken.name}
              {t('” created successfully')}
            </div>
            <p className="text-xs opacity-80">
              {t("Copy this token now — it won't be shown again.")}
            </p>
            <div className="join w-full">
              <input
                type="text"
                value={createdToken.token}
                className="input input-bordered input-sm join-item flex-1 font-mono text-xs bg-success/10"
                readOnly
              />
              <button
                onClick={() => copyToClipboard(createdToken.token)}
                className="btn btn-sm join-item btn-outline"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? t('Copied') : t('Copy')}
              </button>
            </div>
            <button
              onClick={() => {
                setCreatedToken(null)
                setCopied(false)
              }}
              className="btn btn-ghost btn-xs self-end opacity-70"
            >
              {t('Dismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Create + Usage */}
        <div className="space-y-6 lg:col-span-1">
          {/* Create new token */}
          <div className="card bg-base-100 border">
            <div className="card-body gap-4">
              <h2 className="card-title text-base">
                <Plus className="h-4 w-4 text-primary" />
                {t('Generate new token')}
              </h2>

              {error && (
                <div className="alert alert-error text-sm py-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (name.trim()) createMutation.mutate(name.trim())
                }}
                className="space-y-3"
              >
                <fieldset className="fieldset">
                  <legend className="fieldset-legend text-xs">
                    {t('Token name')}
                  </legend>
                  <input
                    type="text"
                    placeholder={t('e.g. CI/CD, CLI, my-laptop')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input input-bordered input-sm w-full"
                    disabled={createMutation.isPending}
                    required
                  />
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend text-xs">
                    {t('Expiration')}
                  </legend>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    disabled={createMutation.isPending}
                  >
                    {TOKEN_EXPIRY_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d === 0 ? t('No expiration') : t('{n} days', { n: d })}
                      </option>
                    ))}
                  </select>
                  {expiryDays === 0 && (
                    <p className="text-xs text-warning mt-1">
                      {t('Tokens without expiration stay valid until revoked.')}
                    </p>
                  )}
                </fieldset>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm w-full"
                  disabled={createMutation.isPending || !name.trim()}
                >
                  {createMutation.isPending ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  {createMutation.isPending ? t('Creating…') : t('Generate')}
                </button>
              </form>
            </div>
          </div>

          {/* Usage instructions */}
          <div className="card bg-base-100 border">
            <div className="card-body gap-3">
              <h3 className="card-title text-base">
                <Terminal className="h-4 w-4 text-primary" />
                {t('Usage')}
              </h3>
              <p className="text-xs text-base-content/60">
                {t('Include your token in the')}{' '}
                <code className="badge badge-xs font-mono">Authorization</code>{' '}
                {t('header:')}
              </p>
              <CommandBlock
                lines={[
                  `curl -H "Authorization: Bearer <token>" ${window.location.origin}/api/v1/skills`,
                ]}
              />
              <p className="text-xs text-base-content/60">
                {t('Or sign in the CLI:')}
              </p>
              <CommandBlock
                lines={[
                  `clawhub login --registry ${window.location.origin} --token <token>`,
                ]}
              />
            </div>
          </div>
        </div>

        {/* Right column — Token list */}
        <div className="lg:col-span-2">
          <div className="card bg-base-100 border h-full">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base">
                  <Key className="h-4 w-4 text-primary" />
                  {t('Active tokens')}
                </h2>
                {tokens.length > 0 && (
                  <div className="badge badge-ghost badge-sm">
                    {tokens.length}
                  </div>
                )}
              </div>

              {tokensQuery.isLoading && (
                <div className="flex justify-center py-12">
                  <span className="loading loading-spinner loading-md" />
                </div>
              )}

              {!tokensQuery.isLoading && tokens.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-base-content/40">
                  <ShieldAlert className="h-10 w-10" />
                  <p className="text-sm">{t('No tokens yet')}</p>
                  <p className="text-xs">
                    {t('Generate your first token to get started')}
                  </p>
                </div>
              )}

              {tokens.length > 0 && (
                <div className="space-y-2 mt-2">
                  {tokens.map((tk: PersonalAccessToken) => (
                    <div
                      key={tk.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-base-100 border border-base-300 hover:border-base-content/20 transition-colors"
                    >
                      <div className="bg-primary/10 text-primary rounded-lg p-2">
                        <Key className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {tk.name || t('(unnamed)')}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-base-content/50 mt-0.5">
                          <span>
                            {t('Created')}{' '}
                            {new Date(tk.created_at).toLocaleDateString()}
                          </span>
                          {tk.last_used_at ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {t('Used')}{' '}
                              {new Date(tk.last_used_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="italic">{t('Never used')}</span>
                          )}
                          <TokenExpiry expiresAt={tk.expires_at} />
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                        onClick={async () => {
                          const ok = await confirm({
                            title: t('Revoke “{name}”?', {
                              name: tk.name || tk.id,
                            }),
                            message:
                              'Anything using this token will stop working immediately. This cannot be undone.',
                            confirmLabel: t('Revoke token'),
                            danger: true,
                          })
                          if (ok) revokeMutation.mutate(tk.id)
                        }}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t('Revoke')}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
