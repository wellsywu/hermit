import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useToast } from './Toast'
import { useT } from '#/i18n'

export function CopyButton({
  text,
  label: labelProp,
  className = 'btn btn-ghost btn-xs btn-square',
  showLabel = false,
}: {
  text: string
  label?: string
  className?: string
  showLabel?: boolean
}) {
  const t = useT()
  const label = labelProp ?? t('Copy')
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('Could not copy to the clipboard'))
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {showLabel && <span>{copied ? t('Copied') : label}</span>}
    </button>
  )
}

/** A terminal-style block with one or more lines and an always-visible copy button. */
export function CommandBlock({
  lines,
  className = '',
}: {
  lines: string[]
  className?: string
}) {
  const t = useT()
  return (
    <div
      className={`command-block flex items-start gap-2 rounded-field pl-3 pr-1.5 py-2 ${className}`}
    >
      <pre className="flex-1 min-w-0 overflow-x-auto text-xs leading-relaxed font-mono py-0.5">
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre">
            <span className="select-none opacity-40">$ </span>
            {line}
          </div>
        ))}
      </pre>
      <CopyButton text={lines.join('\n')} label={t('Copy command')} />
    </div>
  )
}
