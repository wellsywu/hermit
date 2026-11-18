import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center text-center gap-2 ${compact ? 'py-10' : 'py-20'}`}
    >
      <div className="text-base-content/30 mb-1">
        {icon ?? (
          <img
            src="/hermit-crab.svg"
            alt=""
            className="h-14 w-14 opacity-50 grayscale"
          />
        )}
      </div>
      <h2 className="font-semibold text-base-content/80">{title}</h2>
      {description && (
        <p className="text-sm text-base-content/60 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
