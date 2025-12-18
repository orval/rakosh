import { mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import slugify from 'slugify'
import { expect } from 'chai'

import { genTree } from '../cli/extract/tree/gentree.js'

describe('genTree with include wildcard', function () {
  it('writes guide pages under expected path', async function () {
    // minimal in-memory db for the tree walk
    const vertices = [
      { _key: 'adit', label: 'Adit', type: 'passage', fspath: 'adit.md', body: '# Adit' },
      { _key: 'msl', label: 'My Second Lode', type: 'passage', passage: 'msl', fspath: 'msl.md', body: '# My Second Lode' },
      { _key: 'foo', label: 'Foo', type: 'passage', passage: 'foo', fspath: 'foo.md', body: '# Foo' },
      { _key: 'guide', label: 'guide', type: 'passage', passage: 'guide', fspath: 'guide.md', body: '### guide', guide: true },
      { _key: 'bali', label: 'Bali', type: 'passage', passage: 'bali', fspath: 'bali.md', body: '# Bali', guide: 'bali-90' },
      {
        _key: 'flea-90',
        label: 'FLEA-90: Bali Directory Insert - Badger Approved Floops',
        type: 'nugget',
        fspath: 'bali/flea-90.md',
        body: '# FLEA-90: Bali Directory Insert - Badger Approved Floops\n\n## Badger-Approved Floop Functions\n\n- org.floop.Vocoder.vocodeFerret\n',
        guide: 'bali-90',
        nuggets: ['out1']
      },
      {
        _key: 'out1',
        label: 'Outbound child',
        type: 'nugget',
        fspath: 'bali/out1.md',
        body: 'Outbound body',
        guide: 'bali-90'
      }
    ]
    const paths = ['adit|msl', 'adit|msl|foo', 'adit|msl|foo|guide', 'adit|msl|foo|guide|bali', 'adit|msl|foo|guide|bali|flea-90', 'adit|msl|foo|guide|bali|flea-90|out1']

    class FakeDb {
      // eslint-disable-next-line no-useless-constructor
      constructor () {}
      async query (q) {
        const queryText = (typeof q === 'string') ? q : (q.query || '')
        if (queryText.includes('RETURN v')) return this.#cursor(vertices)
        if (queryText.includes('RETURN { keys')) return this.#cursor(paths.map(keys => ({ keys })))
        return this.#cursor([])
      }

      #cursor (items) {
        return {
          async * [Symbol.asyncIterator] () {
            for (const i of items) yield i
          }
        }
      }
    }

    const outDir = mkdtempSync(join(tmpdir(), 'rakosh-tree-include-'))
    try {
      await genTree(new FakeDb(), { include: [{ key: 'guide', value: '*' }], exclude: [], directory: outDir })

      // ensure nested flea guide content is emitted
      const files = []
      const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push({ path: full, content: readFileSync(full, 'utf8') })
          }
        }
      }
      walk(outDir)
      const flea = files.find(f => f.content.includes('Badger-Approved Floop Functions'))
      expect(flea, 'flea-90 nugget not found').to.not.equal(undefined)
      const fleaSlug = slugify('FLEA-90: Bali Directory Insert - Badger Approved Floops')
      const expectedFleaPath = join(outDir, slugify('My Second Lode'), slugify('Foo'), 'guide', slugify('Bali'), `${fleaSlug}.md`)
      expect(flea.path).to.equal(expectedFleaPath)
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  })
})
