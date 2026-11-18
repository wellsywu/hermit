export interface CollectedFile {
  path: string
  file: File
}

const JUNK = [
  /(^|\/)\.git(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)__pycache__(\/|$)/,
  /(^|\/)\.DS_Store$/,
  /(^|\/)Thumbs\.db$/i,
]

/** Files that should never end up inside a published skill archive. */
export function isJunkPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return JUNK.some((re) => re.test(normalized))
}

function readEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function walk(entry: FileSystemEntry, out: CollectedFile[]) {
  const path = entry.fullPath.replace(/^\/+/, '')
  if (isJunkPath(path)) return

  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    )
    out.push({ path, file })
    return
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns results in batches; keep going until it is empty.
    for (;;) {
      const batch = await readEntries(reader)
      if (batch.length === 0) break
      for (const child of batch) await walk(child, out)
    }
  }
}

/** Read everything dropped on the page, descending into folders. */
export async function collectDroppedFiles(
  data: DataTransfer,
): Promise<CollectedFile[]> {
  // Entries must be grabbed synchronously, before the first await.
  const entries = Array.from(data.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
  const plainFiles = Array.from(data.files)

  if (entries.every((e) => e === null)) {
    return plainFiles.map((file) => ({ path: file.name, file }))
  }

  const out: CollectedFile[] = []
  for (const entry of entries) {
    if (entry) await walk(entry, out)
  }
  return out
}
