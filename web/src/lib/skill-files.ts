import { msg } from '#/i18n'

export interface FileEntry {
  path: string
  size: number
}

export type TreeNode =
  | { type: 'file'; name: string; path: string; size: number }
  | { type: 'dir'; name: string; path: string; children: TreeNode[] }

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  for (const node of nodes) {
    if (node.type === 'dir') sortNodes(node.children)
  }
  return nodes
}

/** Turn a flat list of slash-separated paths into a folders-first tree. */
export function buildFileTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = []
  const dirs = new Map<string, TreeNode[]>()
  dirs.set('', root)

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean)
    let parentPath = ''
    let siblings = root
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parentPath ? `${parentPath}/${parts[i]}` : parts[i]
      let children = dirs.get(dirPath)
      if (!children) {
        children = []
        dirs.set(dirPath, children)
        siblings.push({
          type: 'dir',
          name: parts[i],
          path: dirPath,
          children,
        })
      }
      siblings = children
      parentPath = dirPath
    }
    siblings.push({
      type: 'file',
      name: parts[parts.length - 1] ?? file.path,
      path: file.path,
      size: file.size,
    })
  }

  return sortNodes(root)
}

/**
 * Clean up browser-provided relative paths. A folder picked or dropped as a
 * whole arrives as `folder/SKILL.md`; the shared top-level folder is removed
 * so the manifest ends up at the archive root.
 */
export function normalizeUploadPaths(paths: string[]): string[] {
  const cleaned = paths.map((p) =>
    p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/'),
  )
  if (cleaned.length === 0) return cleaned

  const firstSegments = cleaned.map((p) => {
    const idx = p.indexOf('/')
    return idx === -1 ? null : p.slice(0, idx)
  })
  const root = firstSegments[0]
  const sharedRoot = root !== null && firstSegments.every((s) => s === root)
  if (!sharedRoot) return cleaned
  return cleaned.map((p) => p.slice(root.length + 1))
}

const MANIFEST_NAMES = new Set(['skill.md', 'skills.md'])

/** The manifest must sit at the archive root; the server enforces the same. */
export function findManifestPath(paths: string[]): string | undefined {
  return paths.find((p) => MANIFEST_NAMES.has(p.toLowerCase()))
}

export function isManifestPath(path: string): boolean {
  return MANIFEST_NAMES.has(path.toLowerCase())
}

/** Minimal YAML front matter reader: top-level `key: value` pairs only. */
export function parseFrontMatter(markdown: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (!kv) continue
    let value = kv[2].trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    if (value) result[kv[1]] = value
  }
  return result
}

export function stripFrontMatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart()
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Returns an error message, or null when the slug is usable. */
export function validateSlug(value: string): string | null {
  if (!value) return msg('Slug is required')
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value) || value.includes('..')) {
    return msg(
      'Use lowercase letters, numbers and hyphens, starting with a letter or number',
    )
  }
  return null
}

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/

/** Returns an error message, or null when the version is valid semver. */
export function validateVersion(value: string): string | null {
  if (!value) return msg('Version is required')
  if (!SEMVER.test(value)) return msg('Use semantic versioning, e.g. 1.0.0')
  return null
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  sh: 'bash',
  zsh: 'bash',
  bash: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  html: 'xml',
  xml: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  graphql: 'graphql',
  md: 'markdown',
  mdx: 'markdown',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  kt: 'kotlin',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
}

export function getLanguage(filePath: string): string {
  const name = filePath.split('/').pop()?.toLowerCase() ?? ''
  const ext = name.includes('.') ? (name.split('.').pop() ?? '') : name
  return LANG_MAP[ext] ?? 'plaintext'
}
