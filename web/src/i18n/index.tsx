import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { zh } from './zh'

export type Lang = 'en' | 'zh'

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' },
]

const STORAGE_KEY = 'hermit-lang'

// English text is the lookup key, so English needs no dictionary and a
// missing translation falls back to readable English.
const DICTIONARIES: Record<Lang, Record<string, string> | null> = {
  en: null,
  zh,
}

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'zh') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

let currentLang: Lang = detectLang()

/** Current language for code that runs outside React (formatters). */
export function getLang(): Lang {
  return currentLang
}

export type Vars = Record<string, string | number>

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const template = DICTIONARIES[lang]?.[text] ?? text
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

/**
 * Marks a string defined outside a component (constants, validators) as
 * translatable. It returns the text unchanged; pass it through `t()` when
 * rendering.
 */
export function msg(text: string): string {
  return text
}

export type TranslateFn = (text: string, vars?: Vars) => string

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TranslateFn
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang)

  const setLang = useCallback((next: Lang) => {
    currentLang = next
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (text, vars) => translate(lang, text, vars),
    }),
    [lang, setLang],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within I18nProvider')
  return ctx
}

export function useT(): TranslateFn {
  return useI18n().t
}

export function useLang() {
  const { lang, setLang } = useI18n()
  return { lang, setLang }
}
