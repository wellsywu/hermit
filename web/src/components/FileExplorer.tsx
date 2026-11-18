import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { api, formatBytes } from '#/api'
import type { SkillFile } from '#/api'
import { buildFileTree, getLanguage, isManifestPath } from '#/lib/skill-files'
import type { TreeNode } from '#/lib/skill-files'
import { MarkdownContent, useCodeTheme } from './MarkdownContent'
import { SkeletonLines } from './SkeletonLines'
import { CopyButton } from './ui/CopyButton'
import { useT } from '#/i18n'

export function FileExplorer({
  slug,
  version,
  files,
  selected,
  onSelect,
}: {
  slug: string
  version: string
  files: SkillFile[]
  /** Path chosen by the user (kept in the URL by the caller). */
  selected?: string
  onSelect: (path: string | undefined) => void
}) {
  const t = useT()
  const tree = useMemo(() => buildFileTree(files), [files])
  const codeTheme = useCodeTheme()

  const explicit = files.some((f) => f.path === selected) ? selected : undefined
  // On wide screens there is always something in the preview pane.
  const fallback = (files.find((f) => !isManifestPath(f.path)) ?? files.at(0))
    ?.path
  const active = explicit ?? fallback
  const activeFile = files.find((f) => f.path === active)

  const {
    data: content,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['file-content', slug, active, version],
    queryFn: () => api.getFileContent(slug, active!, version),
    enabled: !!active,
  })

  return (
    <div className="grid md:grid-cols-[17rem_minmax(0,1fr)] border border-base-300 rounded-box overflow-hidden bg-base-100 md:h-[min(72vh,46rem)]">
      {/* Tree */}
      <div
        className={`flex-col min-h-0 md:border-r border-base-300 ${
          explicit ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex justify-between items-center px-3 h-10 border-b border-base-300 bg-base-200/60 text-xs shrink-0">
          <span className="font-semibold text-base-content/60">
            {t('Files')}
          </span>
          <span className="text-base-content/40">{files.length}</span>
        </div>
        <div className="overflow-y-auto py-1 max-h-96 md:max-h-none flex-1">
          <TreeNodes
            nodes={tree}
            depth={0}
            active={active}
            onSelect={onSelect}
          />
        </div>
      </div>

      {/* Preview */}
      <div
        className={`flex-col min-h-0 min-w-0 ${explicit ? 'flex' : 'hidden md:flex'}`}
      >
        <div className="flex items-center gap-2 px-3 h-10 border-b border-base-300 bg-base-200/60 shrink-0">
          <button
            type="button"
            className="btn btn-ghost btn-xs md:hidden -ml-1"
            onClick={() => onSelect(undefined)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('Files')}
          </button>
          <span className="font-mono text-xs text-base-content/70 truncate flex-1">
            {active ?? '—'}
          </span>
          {activeFile && (
            <span className="text-xs text-base-content/40 shrink-0">
              {formatBytes(activeFile.size)}
            </span>
          )}
          {content && (
            <CopyButton text={content} label={t('Copy file contents')} />
          )}
        </div>

        <div className="overflow-auto flex-1 min-h-48 max-h-[70vh] md:max-h-none">
          {!active ? (
            <div className="grid place-items-center h-full text-sm text-base-content/40 p-8">
              {t('No files in this version')}
            </div>
          ) : isLoading ? (
            <div className="p-5">
              <SkeletonLines lines={8} height="h-3" />
            </div>
          ) : isError ? (
            <div className="grid place-items-center h-full text-sm text-error p-8">
              {t('Could not load this file')}
            </div>
          ) : !content ? (
            <div className="grid place-items-center h-full text-sm text-base-content/40 p-8">
              {t('This file is empty')}
            </div>
          ) : /\.mdx?$/i.test(active) ? (
            <div className="p-5">
              <MarkdownContent
                content={content}
                stripHeading={isManifestPath(active)}
              />
            </div>
          ) : (
            <div className="code-surface font-mono min-h-full">
              <SyntaxHighlighter
                language={getLanguage(active)}
                style={codeTheme}
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                  background: 'transparent',
                }}
                codeTagProps={{ style: { fontFamily: 'inherit' } }}
                showLineNumbers
                lineNumberStyle={{
                  color: 'inherit',
                  opacity: 0.35,
                  minWidth: '2.75em',
                }}
              >
                {content}
              </SyntaxHighlighter>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TreeNodes({
  nodes,
  depth,
  active,
  onSelect,
}: {
  nodes: TreeNode[]
  depth: number
  active?: string
  onSelect: (path: string) => void
}) {
  return (
    <ul>
      {nodes.map((node) =>
        node.type === 'dir' ? (
          <DirNode
            key={node.path}
            node={node}
            depth={depth}
            active={active}
            onSelect={onSelect}
          />
        ) : (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => onSelect(node.path)}
              aria-current={active === node.path ? 'true' : undefined}
              className={`tree-row ${active === node.path ? 'tree-row-active' : ''}`}
              style={{ paddingLeft: `${depth * 0.875 + 0.75}rem` }}
              title={node.path}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <span className="truncate">{node.name}</span>
            </button>
          </li>
        ),
      )}
    </ul>
  )
}

function DirNode({
  node,
  depth,
  active,
  onSelect,
}: {
  node: Extract<TreeNode, { type: 'dir' }>
  depth: number
  active?: string
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(true)
  const Chevron = open ? ChevronDown : ChevronRight
  const FolderIcon = open ? FolderOpen : Folder
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="tree-row"
        style={{ paddingLeft: `${depth * 0.875 + 0.25}rem` }}
      >
        <Chevron className="h-3 w-3 shrink-0 opacity-50" />
        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-primary/70" />
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <TreeNodes
          nodes={node.children}
          depth={depth + 1}
          active={active}
          onSelect={onSelect}
        />
      )}
    </li>
  )
}
