import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useT } from '#/i18n'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TONE = {
  success: { className: 'alert-success', Icon: CheckCircle2, ttl: 4000 },
  error: { className: 'alert-error', Icon: AlertCircle, ttl: 7000 },
  info: { className: 'alert-info', Icon: Info, ttl: 4000 },
} as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setItems((list) => [...list.slice(-3), { id, tone, message }])
      setTimeout(() => dismiss(id), TONE[tone].ttl)
    },
    [dismiss],
  )

  const apiRef = useRef<ToastApi>({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  })

  return (
    <ToastContext value={apiRef.current}>
      {children}
      <div
        className="toast toast-end toast-bottom z-[60] max-w-[calc(100vw-2rem)]"
        role="status"
        aria-live="polite"
      >
        {items.map(({ id, tone, message }) => {
          const { className, Icon } = TONE[tone]
          return (
            <div
              key={id}
              className={`alert ${className} toast-enter shadow-lg text-sm py-2.5 pr-2 flex`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-normal break-words min-w-0 flex-1">
                {message}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => dismiss(id)}
                aria-label={t('Dismiss')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

/**
 * Drop-in replacement for a pair of `error` / `success` message states:
 * setting a message shows a toast, clearing it (null) does nothing.
 */
export function useFlash() {
  const toast = useToast()
  return useMemo(
    () => ({
      setError: (message: string | null) => {
        if (message) toast.error(message)
      },
      setSuccess: (message: string | null) => {
        if (message) toast.success(message)
      },
    }),
    [toast],
  )
}
