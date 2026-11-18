import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { translate } from '#/i18n'
import { zh } from '#/i18n/zh'

const SRC = path.resolve(__dirname, '../../src')

/** Every literal passed to t('…') or msg('…') anywhere in the app. */
function collectKeys(dir: string, keys = new Set<string>()): Set<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n') collectKeys(full, keys)
    } else if (/\.tsx?$/.test(entry.name)) {
      const source = fs.readFileSync(full, 'utf8')
      // The formatter picks single or double quotes depending on the text.
      for (const m of source.matchAll(
        /\b(?:t|msg)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g,
      )) {
        // Exactly one of the two groups matched; the other is undefined.
        const [, single, double] = m as unknown as (string | undefined)[]
        const raw = single ?? double
        if (raw !== undefined) keys.add(raw.replace(/\\(['"])/g, '$1'))
      }
    }
  }
  return keys
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('zh dictionary', () => {
  const keys = collectKeys(SRC)

  it('finds the strings used in the app', () => {
    expect(keys.size).toBeGreaterThan(100)
  })

  it('translates every string used in the app', () => {
    const missing = [...keys].filter((key) => !(key in zh)).sort()
    expect(missing).toEqual([])
  })

  it('has no entries that the app no longer uses', () => {
    const unused = Object.keys(zh)
      .filter((key) => !keys.has(key))
      .sort()
    expect(unused).toEqual([])
  })

  it('keeps the same placeholders as the English text', () => {
    const mismatched = Object.entries(zh)
      .filter(([en, cn]) => placeholders(en).join() !== placeholders(cn).join())
      .map(([en]) => en)
    expect(mismatched).toEqual([])
  })
})

describe('translate', () => {
  it('falls back to the English text when there is no translation', () => {
    expect(translate('zh', 'A string nobody translated')).toBe(
      'A string nobody translated',
    )
  })

  it('returns the text unchanged for English', () => {
    expect(translate('en', 'Skills')).toBe('Skills')
  })

  it('fills in placeholders', () => {
    expect(translate('en', 'Delete “{name}”?', { name: 'x' })).toBe(
      'Delete “x”?',
    )
  })

  it('leaves unknown placeholders alone', () => {
    expect(translate('en', 'Hello {who}', {})).toBe('Hello {who}')
  })
})
