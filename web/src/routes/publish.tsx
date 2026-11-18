import { useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderUp,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { APIError, api, formatBytes } from '#/api'
import type { PublishFile } from '#/api'
import {
  findManifestPath,
  normalizeUploadPaths,
  parseFrontMatter,
  slugify,
  validateSlug,
  validateVersion,
} from '#/lib/skill-files'
import { collectDroppedFiles, isJunkPath } from '#/lib/collect-files'
import { PageHeader } from '#/components/ui/PageHeader'
import { CommandBlock } from '#/components/ui/CopyButton'
import { useToast } from '#/components/ui/Toast'
import { useT } from '#/i18n'

export const Route = createFileRoute('/publish')({
  component: PublishPage,
})

const EMPTY_FORM = {
  slug: '',
  displayName: '',
  version: '',
  changelog: '',
  summary: '',
  tags: '',
}

type Form = typeof EMPTY_FORM

function PublishPage() {
  const t = useT()
  const toast = useToast()
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>(
    {},
  )
  const [files, setFiles] = useState<PublishFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [published, setPublished] = useState<{
    slug: string
    version: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const paths = useMemo(() => files.map((f) => f.path), [files])
  const manifestPath = findManifestPath(paths)
  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0)

  const rawSlugError = validateSlug(form.slug)
  const rawVersionError = validateVersion(form.version)
  const slugError = rawSlugError && t(rawSlugError)
  const versionError = rawVersionError && t(rawVersionError)

  // Tell the author whether this is a new skill or a new version of one.
  const slugReady = !slugError
  const existing = useQuery({
    queryKey: ['skill', form.slug],
    queryFn: () => api.getSkill(form.slug),
    enabled: slugReady,
    retry: false,
    staleTime: 30_000,
  })
  const existingLatest = existing.data?.latestVersion?.version
  const isNewSkill =
    slugReady &&
    existing.error instanceof APIError &&
    existing.error.status === 404
  const sameAsLatest = !!existingLatest && existingLatest === form.version

  const set = (key: keyof Form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  const addFiles = async (incoming: { path: string; file: File }[]) => {
    const usable = incoming.filter((f) => !isJunkPath(f.path))
    if (usable.length === 0) return
    const normalized = normalizeUploadPaths(usable.map((f) => f.path))
    const added = usable.map((f, i) => ({ path: normalized[i], file: f.file }))

    const merged = new Map(files.map((f) => [f.path, f]))
    for (const f of added) merged.set(f.path, f)
    const next = [...merged.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    )
    setFiles(next)

    // Prefill untouched fields from the manifest front matter.
    const manifest = added.find(
      (f) => f.path === findManifestPath(added.map((a) => a.path)),
    )
    if (!manifest) return
    try {
      const meta = parseFrontMatter(await manifest.file.text())
      setForm((f) => ({
        ...f,
        slug: touched.slug || !meta.name ? f.slug : slugify(meta.name),
        displayName:
          touched.displayName || !meta.name ? f.displayName : meta.name,
        summary:
          touched.summary || !meta.description ? f.summary : meta.description,
        version: touched.version || !meta.version ? f.version : meta.version,
      }))
    } catch {
      // Unreadable manifest: leave the form for manual entry.
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.publishSkill(
        {
          slug: form.slug,
          displayName: form.displayName.trim() || form.slug,
          version: form.version,
          changelog: form.changelog,
          summary: form.summary.trim() || undefined,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        files,
      ),
    onSuccess: () => {
      setPublished({ slug: form.slug, version: form.version })
      window.scrollTo({ top: 0 })
    },
    onError: (err: APIError) => {
      toast.error(
        err.status === 409
          ? t(
              'Version {version} of “{slug}” already exists. Versions are immutable — bump the version number.',
              { version: form.version, slug: form.slug },
            )
          : err.status === 403
            ? t(
                'You do not have permission to publish. Ask an admin for the push role.',
              )
            : t('Publish failed: {error}', { error: err.message }),
      )
    },
  })

  const reset = () => {
    setPublished(null)
    setForm(EMPTY_FORM)
    setTouched({})
    setFiles([])
    mutation.reset()
  }

  if (published) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-5">
        <div className="bg-success/10 rounded-2xl p-6 inline-block">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('Published')}
          </h1>
          <p className="text-base-content/60 mt-1">
            <span className="font-mono">{published.slug}</span> v
            {published.version} {t('is now available to install.')}
          </p>
        </div>
        <CommandBlock
          className="text-left"
          lines={[
            `clawhub install --registry ${window.location.origin} ${published.slug}`,
          ]}
        />
        <div className="flex gap-2 justify-center">
          <Link
            to="/skills/$slug"
            params={{ slug: published.slug }}
            className="btn btn-primary btn-sm"
          >
            {t('View skill')}
          </Link>
          <button className="btn btn-sm" onClick={reset}>
            {t('Publish another')}
          </button>
        </div>
      </div>
    )
  }

  const filesReady = files.length > 0 && !!manifestPath
  const canSubmit =
    filesReady &&
    !slugError &&
    !versionError &&
    !sameAsLatest &&
    form.changelog.trim().length > 0 &&
    !mutation.isPending

  const blocker = !files.length
    ? t('Add the skill files first')
    : !manifestPath
      ? t('SKILL.md is missing')
      : slugError && !form.slug
        ? t('Enter a slug')
        : slugError
          ? t('Fix the slug')
          : versionError && !form.version
            ? t('Enter a version')
            : versionError
              ? t('Fix the version')
              : sameAsLatest
                ? t('This version already exists')
                : !form.changelog.trim()
                  ? t('Describe what changed')
                  : null

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTouched({ slug: true, version: true, changelog: true })
        if (canSubmit) mutation.mutate()
      }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <PageHeader
        title={t('Publish a skill')}
        description={t(
          'Upload a skill folder to the hosted repository. Every version is immutable once published.',
        )}
      />

      {/* Step 1 */}
      <Step number={1} title={t('Skill files')} done={filesReady}>
        <div
          className={`border-2 border-dashed rounded-box p-8 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-base-300'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => {
            e.preventDefault()
            setDragging(false)
            addFiles(await collectDroppedFiles(e.dataTransfer))
          }}
        >
          <Upload className="h-7 w-7 mx-auto mb-3 text-base-content/40" />
          <p className="font-medium">{t('Drop your skill folder here')}</p>
          <p className="text-sm text-base-content/60 mt-1">
            {t('It must contain a')} <code className="font-mono">SKILL.md</code>{' '}
            {t('at its top level.')}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp className="h-4 w-4" />
              {t('Choose folder')}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('Choose files')}
            </button>
          </div>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            // Non-standard but supported by every current desktop browser.
            {...({ webkitdirectory: '' } as object)}
            onChange={(e) => {
              const list = Array.from(e.target.files ?? [])
              addFiles(
                list.map((file) => ({
                  path: file.webkitRelativePath || file.name,
                  file,
                })),
              )
              e.target.value = ''
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? [])
              addFiles(list.map((file) => ({ path: file.name, file })))
              e.target.value = ''
            }}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {!manifestPath && (
              <div className="alert alert-error alert-soft text-sm py-2">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {t(
                    'No SKILL.md at the top level. Add it, or choose the folder that contains it.',
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-base-content/60">
              <span>
                {files.length} {files.length === 1 ? t('file') : t('files')} ·{' '}
                {formatBytes(totalSize)}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setFiles([])}
              >
                <Trash2 className="h-3 w-3" />
                {t('Clear all')}
              </button>
            </div>
            <ul className="border border-base-300 rounded-field divide-y divide-base-300 max-h-64 overflow-y-auto bg-base-100">
              {files.map((f) => (
                <li
                  key={f.path}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-base-content/40" />
                  <span className="font-mono text-xs truncate flex-1">
                    {f.path}
                  </span>
                  {f.path === manifestPath && (
                    <span className="badge badge-success badge-soft badge-xs">
                      {t('manifest')}
                    </span>
                  )}
                  <span className="text-xs text-base-content/50 shrink-0">
                    {formatBytes(f.file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((list) => list.filter((x) => x.path !== f.path))
                    }
                    className="btn btn-ghost btn-xs btn-circle"
                    aria-label={t('Remove {path}', { path: f.path })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Step>

      {/* Step 2 */}
      <Step
        number={2}
        title={t('Details')}
        done={!slugError && !versionError && !!form.changelog.trim()}
      >
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
          <Field
            label={t('Slug')}
            required
            error={touched.slug ? slugError : null}
            hint={
              isNewSkill
                ? t('New skill — this slug is available.')
                : existingLatest
                  ? t('Existing skill — latest is v{version}.', {
                      version: existingLatest,
                    })
                  : t('The install name, e.g. code-review')
            }
          >
            <input
              type="text"
              placeholder="my-skill"
              value={form.slug}
              onChange={(e) => set('slug', e.target.value.toLowerCase())}
              className={`input w-full font-mono ${
                touched.slug && slugError ? 'input-error' : ''
              }`}
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <Field
            label={t('Version')}
            required
            error={
              touched.version
                ? (versionError ??
                  (sameAsLatest
                    ? t('v{version} is already published', {
                        version: form.version,
                      })
                    : null))
                : null
            }
            hint={t('Semantic version, e.g. 1.0.0')}
          >
            <input
              type="text"
              placeholder="1.0.0"
              value={form.version}
              onChange={(e) => set('version', e.target.value.trim())}
              className={`input w-full font-mono ${
                touched.version && (versionError || sameAsLatest)
                  ? 'input-error'
                  : ''
              }`}
              spellCheck={false}
            />
          </Field>
          <Field label={t('Display name')} hint={t('Defaults to the slug')}>
            <input
              type="text"
              placeholder={t('My Skill')}
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              className="input w-full"
            />
          </Field>
          <Field
            label={t('Extra tags')}
            hint={t('Comma-separated. “latest” is always set.')}
          >
            <input
              type="text"
              placeholder="stable, beta"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              className="input w-full"
            />
          </Field>
        </div>
        <Field
          label={t('Summary')}
          hint={t('One or two sentences shown in the catalog')}
        >
          <textarea
            placeholder={t('What this skill does and when to use it')}
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
            className="textarea w-full"
            rows={2}
          />
        </Field>
        <Field
          label={t('Changelog')}
          required
          error={
            touched.changelog && !form.changelog.trim()
              ? t('Describe what changed in this version')
              : null
          }
        >
          <textarea
            placeholder={t('What changed in this version')}
            value={form.changelog}
            onChange={(e) => set('changelog', e.target.value)}
            className={`textarea w-full ${
              touched.changelog && !form.changelog.trim()
                ? 'textarea-error'
                : ''
            }`}
            rows={3}
          />
        </Field>
      </Step>

      {/* Step 3 */}
      <Step number={3} title={t('Publish')}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {mutation.isPending ? t('Publishing…') : t('Publish')}
          </button>
          <Link to="/" className="btn btn-ghost">
            {t('Cancel')}
          </Link>
          {blocker && (
            <span className="text-sm text-base-content/50">{blocker}</span>
          )}
        </div>
        <div className="pt-2 space-y-1.5">
          <p className="eyebrow">{t('Or publish from the CLI')}</p>
          <CommandBlock
            lines={[
              `clawhub publish ./${form.slug || 'my-skill'} --registry ${window.location.origin} --version ${form.version || '1.0.0'}`,
            ]}
          />
        </div>
      </Step>
    </form>
  )
}

function Step({
  number,
  title,
  done = false,
  children,
}: {
  number: number
  title: string
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-5 sm:p-6 space-y-4">
      <h2 className="flex items-center gap-3 font-semibold text-lg">
        <span
          className={`h-7 w-7 rounded-full grid place-items-center text-sm font-bold ${
            done
              ? 'bg-success text-success-content'
              : 'bg-base-200 text-base-content/60'
          }`}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1 py-1">
      <span className="text-xs font-semibold text-base-content/70">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {children}
      <span
        className={`block text-xs min-h-4 ${error ? 'text-error' : 'text-base-content/50'}`}
      >
        {error ?? hint}
      </span>
    </label>
  )
}
