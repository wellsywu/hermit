import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '#/i18n'

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext value={confirm}>
      {children}
      {options && (
        <dialog
          open
          className="modal modal-open"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close(false)
          }}
        >
          <div className="modal-box max-w-sm" role="alertdialog">
            <h3 className="font-semibold text-lg">{options.title}</h3>
            {options.message && (
              <div className="text-sm text-base-content/70 mt-2">
                {options.message}
              </div>
            )}
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => close(false)}
              >
                {options.cancelLabel ?? t('Cancel')}
              </button>
              <button
                type="button"
                autoFocus
                className={`btn btn-sm ${options.danger ? 'btn-error' : 'btn-primary'}`}
                onClick={() => close(true)}
              >
                {options.confirmLabel ?? t('Confirm')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => close(false)} />
        </dialog>
      )}
    </ConfirmContext>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
