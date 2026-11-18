import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Trash2, ToggleLeft, ToggleRight, Lock } from 'lucide-react'
import { authConfigApi } from '#/api'
import type { APIError, AuthConfigItem } from '#/api'
import { useFlash } from '#/components/ui/Toast'
import { msg, useT } from '#/i18n'

const LDAP_FIELDS = [
  {
    key: 'url',
    label: msg('LDAP URL'),
    placeholder: 'ldap://ldap.example.com:389',
    required: true,
  },
  {
    key: 'base_dn',
    label: msg('Base DN'),
    placeholder: 'dc=example,dc=com',
    required: true,
  },
  {
    key: 'bind_dn',
    label: msg('Bind DN'),
    placeholder: 'cn=readonly,dc=example,dc=com',
  },
  {
    key: 'bind_password',
    label: msg('Bind Password'),
    placeholder: '••••••••',
    sensitive: true,
  },
  {
    key: 'user_filter',
    label: msg('User Filter'),
    placeholder: '(uid={{.Username}})',
  },
  { key: 'user_attr', label: msg('User Attribute'), placeholder: 'uid' },
  { key: 'display_attr', label: msg('Display Attribute'), placeholder: 'cn' },
] as const

export function AuthConfigSection() {
  const t = useT()
  const queryClient = useQueryClient()
  const { setError, setSuccess } = useFlash()

  const { data, isLoading } = useQuery({
    queryKey: ['auth-configs'],
    queryFn: () => authConfigApi.list(),
  })

  const configs = data?.configs ?? []
  const ldapConfig = configs.find((c) => c.provider_type === 'ldap')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('Authentication')}
        </h1>
        <p className="text-sm text-base-content/60 mt-1">
          {t(
            'Local accounts are always available. Configure LDAP to let people sign in with their directory account.',
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-md" />
        </div>
      ) : (
        <div className="max-w-lg">
          <ProviderCard
            type="ldap"
            title="LDAP"
            icon={<Lock className="h-5 w-5" />}
            fields={LDAP_FIELDS}
            existing={ldapConfig}
            extraBoolFields={[
              { key: 'start_tls', label: msg('StartTLS') },
              { key: 'skip_verify', label: msg('Skip TLS Verify') },
            ]}
            onSuccess={(message) => {
              setSuccess(message)
              setError(null)
              queryClient.invalidateQueries({ queryKey: ['auth-configs'] })
            }}
            onError={(message) => {
              setError(message)
              setSuccess(null)
            }}
          />
        </div>
      )}
    </div>
  )
}

function ProviderCard({
  type,
  title,
  icon,
  fields,
  existing,
  extraBoolFields,
  onSuccess,
  onError,
}: {
  type: string
  title: string
  icon: React.ReactNode
  fields: readonly {
    key: string
    label: string
    placeholder?: string
    required?: boolean
    sensitive?: boolean
  }[]
  existing?: AuthConfigItem
  extraBoolFields?: { key: string; label: string }[]
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const t = useT()
  const existingConfig = existing?.config ?? {}
  const [enabled, setEnabled] = useState(existing?.enabled ?? false)
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const data: Record<string, string> = {}
    for (const f of fields) {
      const val = existingConfig[f.key]
      data[f.key] =
        typeof val === 'string'
          ? f.sensitive && val === '••••••••'
            ? ''
            : val
          : ''
    }
    return data
  })
  const [boolData, setBoolData] = useState<Record<string, boolean>>(() => {
    const data: Record<string, boolean> = {}
    if (extraBoolFields) {
      for (const f of extraBoolFields) {
        data[f.key] = !!existingConfig[f.key]
      }
    }
    return data
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const config: Record<string, any> = {}
      for (const f of fields) {
        if (f.sensitive && formData[f.key] === '') {
          if (existingConfig[f.key] && existingConfig[f.key] !== '••••••••') {
            config[f.key] = existingConfig[f.key]
          }
        } else {
          config[f.key] = formData[f.key]
        }
      }
      if (extraBoolFields) {
        for (const f of extraBoolFields) {
          config[f.key] = boolData[f.key]
        }
      }
      if (typeof config.admin_groups === 'string') {
        config.admin_groups = config.admin_groups
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      }
      return authConfigApi.save(type, enabled, config)
    },
    onSuccess: () =>
      onSuccess(t('{name} configuration saved', { name: title })),
    onError: (err: APIError) => onError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => authConfigApi.remove(type),
    onSuccess: () => {
      setEnabled(false)
      const reset: Record<string, string> = {}
      for (const f of fields) reset[f.key] = ''
      setFormData(reset)
      onSuccess(t('{name} configuration removed', { name: title }))
    },
    onError: (err: APIError) => onError(err.message),
  })

  return (
    <div
      className={`card border ${enabled ? 'bg-base-200 border-primary/30' : 'bg-base-200'}`}
    >
      <div className="card-body">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`btn btn-ghost btn-xs gap-1 ${enabled ? 'text-success' : 'text-base-content/40'}`}
          >
            {enabled ? (
              <>
                <ToggleRight className="h-4 w-4" /> {t('Enabled')}
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4" /> {t('Disabled')}
              </>
            )}
          </button>
        </div>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
        >
          {fields.map((f) => (
            <fieldset key={f.key} className="fieldset">
              <legend className="fieldset-legend text-xs">
                {t(f.label)}
                {f.required && <span className="text-error"> *</span>}
              </legend>
              <input
                type={f.sensitive ? 'password' : 'text'}
                placeholder={f.placeholder}
                className="input input-bordered input-sm w-full"
                value={formData[f.key] ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, [f.key]: e.target.value })
                }
              />
            </fieldset>
          ))}

          {extraBoolFields?.map((f) => (
            <label
              key={f.key}
              className="flex items-center gap-2 cursor-pointer py-1"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={boolData[f.key] ?? false}
                onChange={(e) =>
                  setBoolData({ ...boolData, [f.key]: e.target.checked })
                }
              />
              <span className="text-sm">{t(f.label)}</span>
            </label>
          ))}

          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="btn btn-primary btn-sm flex-1"
              disabled={saveMutation.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? t('Saving…') : t('Save')}
            </button>
            {existing && (
              <button
                type="button"
                className="btn btn-error btn-outline btn-sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
