import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react'
import { api, setToken } from '#/api'
import type { APIError } from '#/api'
import { useToast } from './ui/Toast'
import { useT } from '#/i18n'

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const [form, setForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.changePassword(form.oldPassword, form.newPassword),
    onSuccess: (res) => {
      // Older sessions are revoked server-side; keep this one signed in.
      if (res.token) setToken(res.token)
      toast.success(t('Password changed'))
      onClose()
    },
    onError: (err: APIError) => setError(err.message),
  })

  const mismatch =
    form.confirmPassword.length > 0 && form.confirmPassword !== form.newPassword
  const canSubmit =
    form.oldPassword.length > 0 &&
    form.newPassword.length >= 6 &&
    form.newPassword === form.confirmPassword &&
    !mutation.isPending

  return (
    <dialog
      open
      className="modal modal-open"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div className="modal-box max-w-sm">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {t('Change password')}
        </h3>

        {error && (
          <div className="alert alert-error text-sm py-2 mb-4">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) mutation.mutate()
          }}
          className="space-y-3"
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend text-xs">
              {t('Current password')}
            </legend>
            <div className="join w-full">
              <input
                type={showOld ? 'text' : 'password'}
                className="input input-sm join-item flex-1"
                value={form.oldPassword}
                onChange={(e) =>
                  setForm({ ...form, oldPassword: e.target.value })
                }
                autoComplete="current-password"
                autoFocus
                required
              />
              <button
                type="button"
                className="btn btn-sm join-item"
                onClick={() => setShowOld(!showOld)}
                aria-label={showOld ? t('Hide password') : t('Show password')}
              >
                {showOld ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend text-xs">
              {t('New password')}
            </legend>
            <div className="join w-full">
              <input
                type={showNew ? 'text' : 'password'}
                placeholder={t('At least 6 characters')}
                className="input input-sm join-item flex-1"
                value={form.newPassword}
                onChange={(e) =>
                  setForm({ ...form, newPassword: e.target.value })
                }
                autoComplete="new-password"
                required
                minLength={6}
              />
              <button
                type="button"
                className="btn btn-sm join-item"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? t('Hide password') : t('Show password')}
              >
                {showNew ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend text-xs">
              {t('Confirm new password')}
            </legend>
            <input
              type="password"
              className={`input input-sm w-full ${mismatch ? 'input-error' : ''}`}
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              autoComplete="new-password"
              required
              minLength={6}
            />
            {mismatch && (
              <p className="text-xs text-error mt-1">
                {t('Passwords do not match')}
              </p>
            )}
          </fieldset>

          <div className="modal-action mt-4">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!canSubmit}
            >
              {mutation.isPending && (
                <span className="loading loading-spinner loading-xs" />
              )}
              {t('Change password')}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
