'use strict'
import { writeFileSync } from 'node:fs'

export async function generateTree (catalog, output) {
  // this gets a chunk of markdown for each seam then for any remaining nuggets
  const [mdChunks] = await catalog.getSeamNuggetMarkdown()

  mdChunks.shift()
  const allMd = mdChunks.map(c => c + '\n---\n').join('\n') // TODO write tree into dir not MD into a file
  writeFileSync(output, allMd)
  return allMd
}
