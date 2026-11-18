import { describe, expect, it } from 'vitest'
import {
  buildFileTree,
  findManifestPath,
  normalizeUploadPaths,
  parseFrontMatter,
  slugify,
  validateSlug,
  validateVersion,
} from '#/lib/skill-files'

describe('buildFileTree', () => {
  it('nests files under folders, folders first, alphabetical', () => {
    const tree = buildFileTree([
      { path: 'SKILL.md', size: 10 },
      { path: 'scripts/run.py', size: 20 },
      { path: 'scripts/lib/util.py', size: 5 },
      { path: 'assets/logo.svg', size: 7 },
    ])
    expect(tree.map((n) => n.name)).toEqual(['assets', 'scripts', 'SKILL.md'])
    const scripts = tree[1]
    expect(scripts.type).toBe('dir')
    if (scripts.type !== 'dir') throw new Error('expected dir')
    expect(scripts.children.map((n) => n.name)).toEqual(['lib', 'run.py'])
    expect(scripts.children[1]).toMatchObject({
      type: 'file',
      path: 'scripts/run.py',
      size: 20,
    })
  })

  it('returns an empty tree for no files', () => {
    expect(buildFileTree([])).toEqual([])
  })
})

describe('normalizeUploadPaths', () => {
  it('strips the single shared root folder', () => {
    expect(
      normalizeUploadPaths(['my-skill/SKILL.md', 'my-skill/scripts/a.sh']),
    ).toEqual(['SKILL.md', 'scripts/a.sh'])
  })

  it('keeps paths when there is no shared root', () => {
    expect(normalizeUploadPaths(['SKILL.md', 'scripts/a.sh'])).toEqual([
      'SKILL.md',
      'scripts/a.sh',
    ])
  })

  it('normalizes backslashes and leading slashes', () => {
    expect(normalizeUploadPaths(['\\root\\SKILL.md', '/root/x.txt'])).toEqual([
      'SKILL.md',
      'x.txt',
    ])
  })

  it('does not strip when a file sits at the top level', () => {
    expect(normalizeUploadPaths(['SKILL.md'])).toEqual(['SKILL.md'])
  })
})

describe('findManifestPath', () => {
  it('finds SKILL.md at the root, case-insensitively', () => {
    expect(findManifestPath(['a.txt', 'skill.md'])).toBe('skill.md')
    expect(findManifestPath(['skills.md'])).toBe('skills.md')
  })

  it('ignores a manifest nested in a subfolder', () => {
    expect(findManifestPath(['docs/SKILL.md'])).toBeUndefined()
  })
})

describe('parseFrontMatter', () => {
  it('reads simple key/value pairs and strips quotes', () => {
    const md = [
      '---',
      'name: code-review',
      'description: "Reviews a diff: finds bugs"',
      "version: '1.2.0'",
      '---',
      '# Title',
    ].join('\n')
    expect(parseFrontMatter(md)).toEqual({
      name: 'code-review',
      description: 'Reviews a diff: finds bugs',
      version: '1.2.0',
    })
  })

  it('handles CRLF line endings', () => {
    expect(parseFrontMatter('---\r\nname: a\r\n---\r\nbody')).toEqual({
      name: 'a',
    })
  })

  it('returns an empty object without front matter', () => {
    expect(parseFrontMatter('# Just a title')).toEqual({})
  })
})

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('  My Cool_Skill!  ')).toBe('my-cool-skill')
  })
})

describe('validateSlug', () => {
  it('accepts lowercase slugs', () => {
    expect(validateSlug('code-review2')).toBeNull()
  })

  it.each(['', 'Has Space', 'a/b', '..', 'UPPER', '-lead'])(
    'rejects %j',
    (value) => {
      expect(validateSlug(value)).toBeTypeOf('string')
    },
  )
})

describe('validateVersion', () => {
  it.each(['1.0.0', '0.1.12', '2.0.0-beta.1', '1.0.0+build.5'])(
    'accepts %s',
    (value) => {
      expect(validateVersion(value)).toBeNull()
    },
  )

  it.each(['', '1.0', 'v1.0.0', '1.0.0.0', 'latest'])('rejects %j', (value) => {
    expect(validateVersion(value)).toBeTypeOf('string')
  })
})
