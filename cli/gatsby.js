'use strict'
import { execFileSync } from 'node:child_process'
import { statSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

import { Database } from 'arangojs'
import { aql } from 'arangojs/aql.js'
import log from 'loglevel'
import mustache from 'mustache'
import ncp from 'ncp'

import { MineMap } from './extract/lib/minemap.js'
import { Nugget } from './lib/nugget.js'
import { NuggetCatalog } from './extract/lib/nugget_catalog.js'
import exclude from './lib/option_exclude.js'
import include from './lib/option_include.js'

const ncpp = promisify(ncp)

log.setLevel('WARN')

export default {
  command: 'gatsby <mine> <sitecustom> <directory>',
  describe: 'Extract the data from a mine into a Gatsby.js site layout',

  builder: (yargs) => {
    return yargs
      .positional('mine', {
        describe: 'The name of the mine to extract',
        string: true
      })
      .positional('sitecustom', {
        describe: 'A JSON file for site customizations',
        string: true,
        normalize: true,
        coerce: f => {
          try {
            if (!statSync(f).isFile()) throw new Error('not a file')
            return JSON.parse(readFileSync(f, 'utf8'))
          } catch (err) {
            throw new Error(`${f} cannot be read [${err}]`)
          }
        }
      })
      .positional('directory', {
        describe: 'Target directory into which to extract the data',
        string: true,
        normalize: true,
        coerce: d => {
          try {
            if (!statSync(d).isDirectory()) throw new Error()
          } catch {
            throw new Error(`${d} is not a directory`)
          }
          return d
        }
      })
      .option('build', {
        type: 'boolean',
        default: true,
        description: 'Run the build (use --no-build to not)'
      })
      .option('mmap_open', {
        type: 'number',
        alias: 'm',
        default: 2,
        description: 'To what depth is the Mine Map open upon load',
        coerce: m => {
          if (Number.isInteger(m) && m >= 0) return m
          throw new Error(`mmap_open value [${m}] is not valid`)
        }
      })
      .option('include', include)
      .option('exclude', exclude)
  },

  handler: async (argv) => {
    try {
      if (argv.verbose) log.setLevel('INFO')

      const conf = { databaseName: argv.mine }
      if (process.env.ARANGO_URL) conf.url = process.env.ARANGO_URL

      const db = new Database(conf)
      if (!await db.exists()) {
        throw new Error(`mine ${argv.mine} does not exist`)
      }

      const catalog = new NuggetCatalog(db, argv.include, argv.exclude)
      await catalog.init()

      log.info(`extracting to ${argv.directory}`)

      await copyTemplates(argv.directory, argv.sitecustom)
      copyIcon(argv.directory, argv.sitecustom)
      await extractNuggets(db, argv.directory, catalog)
      await generateMineMap(db, argv.directory, argv.m, catalog)
      if (argv.build) buildSite(argv.directory)
    } catch (err) {
      log.error(`ERROR: ${err}`)
      process.exit(1)
    }
  }
}

const extensionsToTransform = new Set(['.js', '.jsx', '.mjs', '.json', '.css'])

async function copyTemplates (dir, customizations) {
  // copy and transform template layout to target directory
  log.info(`copy template files to target directory ${dir}`)
  const templateDir = join(dirname(fileURLToPath(import.meta.url)), 'extract', 'gatsby')

  const options = {
    transform: function (read, write, file) {
      const ext = extname(file.name)

      // only transform files that are in our list
      if (!extensionsToTransform.has(ext)) {
        return read.pipe(write)
      }

      let template = ''
      read.on('data', function (chunk) {
        template += chunk
      })
      read.on('end', function () {
        const output = mustache.render(template, customizations)
        write.write(output)
        write.end()
      })
    }
  }

  await ncpp(templateDir, dir, options)
}

function copyIcon (dir, customizations) {
  // user can specify an icon with path reletive to package.json
  if ('icon' in customizations) {
    // errors are caught and logged outside
    copyFileSync(customizations.icon, join(dir, 'src', 'images', 'icon.png'))
  }
}

async function extractNuggets (db, dir, catalog) {
  const contentDir = join(dir, 'content')

  const nugs = await catalog.getAllMdx()
  for (const [nugget, mdx] of nugs) {
    writeFileSync(join(contentDir, `${nugget._key}.mdx`), mdx)

    if ('__media' in nugget) {
      const source = join(dirname(nugget.fspath), nugget.__media.path)

      // copy media file into the content directory using _key as the basename
      const ext = extname(source)
      const mediaFile = join(contentDir, `${nugget._key}${ext}`)
      log.info(`copying media file [${source}] to [${mediaFile}]`)
      copyFileSync(source, mediaFile)
    }
  }

  writeFileSync(join(contentDir, 'slug_lookup.json'), JSON.stringify(catalog.slugLookup, null, 2))
}

async function generateMineMap (db, dir, mmapOpen, catalog) {
  const contentDir = join(dir, 'content')
  const mapFile = join(contentDir, 'minemap.json')

  const cursor = await db.query(aql`
    FOR v, e, p IN 1..100 OUTBOUND 'passage/adit' GRAPH 'primary'
      ${catalog.getFilters()}
      LET vertices = (
          FOR vertex IN p.vertices
              LET order_value = vertex.order == null ? 10000 : vertex.order
              RETURN MERGE(vertex, { order: order_value })
      )
      SORT vertices[*].order ASC, vertices[*].label ASC
      RETURN vertices
  `)

  const mm = new MineMap(catalog, mmapOpen)
  for await (const path of cursor) {
    mm.addVerticies(processPassageSeams(path))
  }

  writeFileSync(mapFile, mm.toTree())

  // when a Passage has a seam it is added to the head Nugget of the seam so that
  // the later deduplication works correctly
  function processPassageSeams (path) {
    let previous = {}
    for (const v of path) {
      // see if the previous vertex in the path was a passage and had a seam and
      // that the current vertex's _id is the head of that seam
      if (previous.type === Nugget.PASSAGE &&
        previous.nuggets &&
        previous.nuggets.length > 0 &&
        v._key === previous.nuggets[0]) {
        if (v.nuggets) {
          log.warn(`WARNING: Nugget ${v._id} cannot be in a seam and have its own seam`)
          continue
        }
        previous.nuggets.pop()
        v.nuggets = previous.nuggets
      }
      previous = v
    }
    return path
  }
}

function buildSite (dir) {
  // assume npm is installed for now
  const manager = 'npm'

  try {
    log.info(`running npm install in ${dir}`)
    const stdout = execFileSync(manager, ['install'], { cwd: dir })
    log.info(stdout.toString())
  } catch (err) {
    log.error(err.stdout.toString())
    log.error(err.stderr.toString())
  }

  // gatsby build
  try {
    log.info(`running gatsby build in ${dir}`)
    const stdout = execFileSync(manager, ['run', 'deploy'], { cwd: dir })
    log.info(stdout.toString())
  } catch (err) {
    log.error(err.stdout.toString())
    log.error(err.stderr.toString())
    process.exit(1)
  }
}
