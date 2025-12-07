import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { expect } from 'chai'
import log from 'loglevel'

import { FsLayout } from '../cli/lib/fs_layout.js'

describe('FsLayout', function () {
  before(() => {
    log.setLevel('silent')
  })

  it('creates an adit file with fs_layout version and heading', function () {
    const dir = mkdtempSync(join(tmpdir(), 'fs-layout-adit-'))
    const layout = new FsLayout(dir)

    const aditPath = join(dir, 'adit.md')
    layout.createAdit(aditPath, 'Root Adit')

    const content = readFileSync(aditPath, 'utf8')
    expect(content).to.match(/fs_layout:\s+'?1\.2'?/)
    expect(content).to.include('_key: adit')
    expect(content).to.include('# Root Adit')
  })

  it('addPassage creates directory and nugget with passage tag', function () {
    const dir = mkdtempSync(join(tmpdir(), 'fs-layout-pass-'))
    const layout = new FsLayout(dir)

    const passageDir = join(dir, 'foo')
    layout.addPassage(passageDir, 'Foo Title')

    const nuggetPath = `${passageDir}.md`
    const statsDir = statSync(passageDir)
    const statsMd = statSync(nuggetPath)
    expect(statsDir.isDirectory()).to.equal(true)
    expect(statsMd.isFile()).to.equal(true)

    const content = readFileSync(nuggetPath, 'utf8')
    expect(content).to.include('passage: foo')
    expect(content).to.match(/### Foo Title/)
  })

  it('add chooses nugget for .md and passage for bare path', function () {
    const dir = mkdtempSync(join(tmpdir(), 'fs-layout-add-'))
    const layout = new FsLayout(dir)

    const nuggetPath = join(dir, 'note.md')
    layout.add(nuggetPath, 'Note Title')
    expect(statSync(nuggetPath).isFile()).to.equal(true)

    const passageDir = join(dir, 'bar')
    layout.add(passageDir, 'Bar Title')
    expect(statSync(passageDir).isDirectory()).to.equal(true)
    expect(statSync(`${passageDir}.md`).isFile()).to.equal(true)
  })

  it('builds tree from sample mine and sets adit root', function () {
    const here = dirname(fileURLToPath(import.meta.url))
    const layout = new FsLayout(join(here, '..', 'examples', 'my-mine'))
    expect(layout.root.model._key).to.equal('adit')
    expect(layout.size()).to.be.greaterThan(5)
  })
})
