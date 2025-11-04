'use strict'
import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export async function generateTree (catalog, directory) {
  const nugs = await catalog.getAllNuggets()
  for (const [nugget, slug] of nugs) {
    const markdown = nugget.body
    if (!markdown) continue

    const dir = join(directory, slug)
    materializeDir(dir)
    writeFileSync(join(dir, nugget.getLabel() + '.md'), markdown)
  }
}

function materializeDir (dir) {
  try {
    const dirStat = statSync(dir)
    if (!dirStat.isDirectory()) throw new Error(`${dir} is not a directory`)
  } catch (err) {
    if (err.code === 'ENOENT') {
      mkdirSync(dir, { recursive: true })
    } else {
      throw err
    }
  }
}
