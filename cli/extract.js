'use strict'
const { statSync, existsSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { execFileSync } = require('node:child_process')
const { format } = require('node:util')
const { Database } = require('arangojs')
const { aql } = require('arangojs/aql')
const { copySync } = require('fs-extra')
const log = require('loglevel')

log.setLevel('WARN')

exports.command = 'extract <format> <mine> <directory>'

exports.describe = 'Extract the data from a mine into some output format'

exports.builder = (yargs) => {
  return yargs
    .positional('format', {
      describe: 'The output format of the extraction',
      string: true,
      choices: ['gatsby']
    })
    .positional('mine', {
      describe: 'The name of the mine to extract',
      string: true
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
}

exports.handler = async function (argv) {
  try {
    if (argv.verbose) log.setLevel('INFO')

    const db = new Database({ databaseName: argv.mine })
    if (!await db.exists()) {
      throw new Error(`mine ${argv.mine} does not exist`)
    }

    log.info(`extracting to ${argv.directory}`)

    if (argv.format === 'gatsby') {
      copyTemplates(argv.directory)
      await extractNuggets(db, argv.directory)
      await extractSeams(db, argv.directory)
      buildSite(argv.directory)
    }
  } catch (err) {
    log.error(`ERROR: ${err}`)
    process.exit(1)
  }
}

function copyTemplates (dir) {
  // copy template layout to target directory
  log.info(`copy template files to target directory ${dir}`)
  const templateDir = join(__dirname, 'extract', 'gatsby')
  copySync(templateDir, dir)
}

async function extractNuggets (db, dir) {
  const nuggetDir = join(dir, 'content', 'nuggets')

  const cursor = await db.query(aql`
    FOR v, e, p IN 1..100 OUTBOUND 'passage/adit' GRAPH 'primary'
      FILTER IS_SAME_COLLECTION('nugget', v)
      RETURN { vertex: LAST(p.vertices) }
  `)

  log.info('extracting nuggets')

  for await (const v of cursor) {
    const nugget = v.vertex
    writeFileSync(
      join(nuggetDir, `${nugget._key}.mdx`),
      format('---\nslug: "%s"\n---\n%s', nugget._id, getNuggetMdx(nugget))
    )
  }
}

function getNuggetMdx (nugget) {
  return format(
    '<Nugget %s>\n%s\n</Nugget>\n',
    Object.keys(nugget).filter(n => n !== 'body').map(n => `${n}="${nugget[n]}"`).join(' '),
    nugget.body
  )
}


async function extractSeams (db, dir) {
  const seamDir = join(dir, 'content', 'seams')

  const cursor = await db.query(aql`
    FOR v, e, p IN 1..100 OUTBOUND 'passage/adit' GRAPH 'primary'
      FILTER IS_SAME_COLLECTION('seam', v)
      RETURN { vertex: LAST(p.vertices) }
  `)

  log.info('extracting seams')

  for await (const v of cursor) {
    const seam = v.vertex
    writeFileSync(
      join(seamDir, `${seam._key}.mdx`),
      format('---\nslug: "%s"\n---\n%s', seam._id, getSeamMdx(seam))
    )
  }
}

function getSeamMdx (seam) {
  let nuggets = ''

  if ('nuggets' in seam) {
    nuggets = seam.nuggets.map(n => `<NuggetLink _key="${n}" />`).join('\n')
  }

  return format(
    '<Seam %s>\n%s\n%s\n</Seam>\n',
    Object.keys(seam).filter(s => s !== 'body').map(s => `${s}="${seam[s]}"`).join(' '),
    seam.body,
    nuggets
  )
}

function buildSite (dir) {
  const gatsby = join(__dirname, '..', 'node_modules', '.bin', 'gatsby')
  if (!existsSync(gatsby)) {
    log.error(`gatsby executable ${gatsby} does not exist`)
    process.exit(1)
  }

  // gatsby needs to be installed locally to the extract
  try {
    log.info(`running npm install in ${dir}`)
    const stdout = execFileSync('npm', ['install'], { cwd: dir })
    log.info(stdout.toString())
  } catch (err) {
    log.error(err.stdout.toString())
    log.error(err.stderr.toString())
  }

  // gatsby build
  try {
    log.info(`running gatsby build in ${dir}`)
    const stdout = execFileSync(gatsby, ['build'], { cwd: dir })
    log.info(stdout.toString())
  } catch (err) {
    log.error(err.stdout.toString())
    log.error(err.stderr.toString())
  }
}
