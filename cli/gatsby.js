'use strict'
const { statSync, writeFileSync, readFileSync } = require('node:fs')
const { join, extname } = require('node:path')
const { execFileSync } = require('node:child_process')
const { Database } = require('arangojs')
const { aql } = require('arangojs/aql')
const ncp = require('ncp').ncp
const mustache = require('mustache')
const util = require('util')
const ncpp = util.promisify(ncp)
const { MineMap } = require('./extract/lib/minemap')
const { Nugget } = require('./lib/nugget')
const { NuggetCatalog } = require('./extract/lib/nugget_catalog')
const { include } = require('./lib/option_include')
const { exclude } = require('./lib/option_exclude')
const log = require('loglevel')
const slugify = require('slugify')

log.setLevel('WARN')

exports.command = 'gatsby <mine> <sitecustom> <directory>'

exports.describe = 'Extract the data from a mine into a Gatsby.js site layout'

exports.builder = (yargs) => {
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
}

exports.handler = async function (argv) {
  try {
    if (argv.verbose) log.setLevel('INFO')

    const conf = { databaseName: argv.mine }
    if (process.env.ARANGO_URL) conf.url = process.env.ARANGO_URL

    const db = new Database(conf)
    if (!await db.exists()) {
      throw new Error(`mine ${argv.mine} does not exist`)
    }

    const catalog = new NuggetCatalog(db, argv.include, argv.exclude, 0)
    await catalog.init()
    const root = await catalog.getTree()

    log.info(`extracting to ${argv.directory}`)

    await copyTemplates(argv.directory, argv.sitecustom)
    await extractNuggets(db, argv.directory, root)
    await generateMineMap(db, argv.directory, argv.m, catalog.getFilters())
    if (argv.build) buildSite(argv.directory)
  } catch (err) {
    log.error(`ERROR: ${err}`)
    process.exit(1)
  }
}

const extensionsToTransform = new Set(['.js', '.jsx', '.mjs', '.json', '.css'])

async function copyTemplates (dir, customizations) {
  // copy and transform template layout to target directory
  log.info(`copy template files to target directory ${dir}`)
  const templateDir = join(__dirname, 'extract', 'gatsby')

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

async function extractNuggets (db, dir, root) {
  const contentDir = join(dir, 'content')
  const nuggetStash = {}
  const slugLookup = {}

  // pull each nugget in the tree into a stash of Nugget objects
  root.walk((n) => {
    nuggetStash[n.model._id] = new Nugget(n.model, n.model.body)
    return true
  })

  // breadcrumbs!
  for (const [_id, nugget] of Object.entries(nuggetStash)) {
    // query the paths from the given vertex back to the adit
    const cursor = await db.query(aql`
      FOR v, e, p IN 1..100 INBOUND ${_id} GRAPH 'primary'
      FILTER v._id == 'passage/adit'
      RETURN REVERSE(
        FOR vertex IN p.vertices[*]
        RETURN { _id: vertex._id, label: vertex.label, shortlabel: vertex.shortlabel, _key: vertex._key }
      )
    `)
    const breadcrumbs = []
    const paths = []
    for await (const c of cursor) {
      // generate URL path for this nugget using slugified labels
      paths.push('/' + c.filter(b => b._id !== 'passage/adit')
        .map(b => slugify(b.shortlabel || b.label).toLowerCase())
        .join('/')
      )

      // filter out the adit and self then push non-zero length paths into list
      const crumb = c.filter(b => b._id !== 'passage/adit' && b._id !== _id)
        .map(({ _id, ...rest }) => rest)

      if (crumb.length > 0) breadcrumbs.push(crumb)
    }
    nugget.breadcrumbs = breadcrumbs
    nugget.paths = paths

    // have paths and keys map to the primary slug
    if (paths.length > 1) {
      paths.slice(1).forEach(e => { slugLookup[e] = paths[0] })
    }
    if (paths.length > 0) {
      slugLookup['/' + nugget._key] = paths[0]
    }
  }

  // get all adjacent vertices for each nugget and write them to the slug
  for (const [_id, nugget] of Object.entries(nuggetStash)) {
    const cursor = await db.query(aql`
      FOR v, e IN 1..1 ANY ${_id} GRAPH 'primary'
      RETURN { v, e }
    `)

    const nuggetsOutbound = []
    const passagesOutbound = []
    const nuggetsInbound = []
    const passagesInbound = []

    for await (const c of cursor) {
      if (c.e._from === _id) {
        const nug = nuggetStash[c.e._to]
        if (!nug) continue // filtered nuggets will not be in the stash
        if (nug.passage) passagesOutbound.push(nug)
        else nuggetsOutbound.push(nug)
      } else if (c.e._to === _id) {
        const nug = nuggetStash[c.e._from]
        if (!nug) continue // filtered nuggets will not be in the stash
        if (nug.passage) passagesInbound.push(nug)
        else nuggetsInbound.push(nug)
      }
    }

    nuggetsOutbound.sort(Nugget.compare)
    passagesOutbound.sort(Nugget.compare)
    nuggetsInbound.sort(Nugget.compare)
    passagesInbound.sort(Nugget.compare)

    // collect up Nugget MDX to append to Seam component
    let append = ''
    if ('nuggets' in nugget) {
      append = nugget.nuggets
        .filter(n => 'nugget/' + n in nuggetStash)
        .map(n => nuggetStash['nugget/' + n].getMdx({ inseam: true }))
        .join('\n')
    }

    const slug = (nugget.paths.length > 0) ? nugget.paths[0] : '/'

    const mdx = [
      nugget.getFrontMatter({ slug }),
      '<NuggetArea>',
      nugget.getMdx({ slug }, append),
      '<NuggetsInbound>',
      ...nuggetsInbound.map(v => v.getMdx({ direction: 'inbound' })),
      '</NuggetsInbound>',
      '<NuggetsOutbound>',
      ...nuggetsOutbound.map(v => v.getMdx({ direction: 'outbound' })),
      '</NuggetsOutbound>',
      '</NuggetArea>',
      '<PassagesInbound>',
      ...passagesInbound.map(v => v.getMdx({ direction: 'inbound' })),
      '</PassagesInbound>',
      '<PassagesOutbound>',
      ...passagesOutbound.map(v => v.getMdx({ direction: 'outbound' })),
      '</PassagesOutbound>'
    ]

    writeFileSync(join(contentDir, `${nugget._key}.mdx`), mdx.join('\n'))
  }

  writeFileSync(join(contentDir, 'slug_lookup.json'), JSON.stringify(slugLookup, null, 2))
}

async function generateMineMap (db, dir, mmapOpen, filters) {
  const contentDir = join(dir, 'content')
  const mapFile = join(contentDir, 'minemap.json')

  const cursor = await db.query(aql`
    FOR v, e, p IN 1..100 OUTBOUND 'passage/adit' GRAPH 'primary'
      ${filters}
      LET vertices = (
          FOR vertex IN p.vertices
              LET order_value = vertex.order == null ? 10000 : vertex.order
              RETURN MERGE(vertex, { order: order_value })
      )
      SORT vertices[*].order ASC, vertices[*].label ASC
      RETURN vertices
  `)

  const mm = new MineMap(mmapOpen)
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
