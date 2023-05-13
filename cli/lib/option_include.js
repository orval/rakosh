'use strict'
exports.include = {
  description: 'Only include nuggets with these "[key:value]" pairs; only word chars are allowed',
  alias: 'i',
  string: true,
  coerce: inc => {
    if (!inc) throw new Error('--include requires key:value pair(s)')
    const includes = []
    inc.split(',').forEach(p => {
      const match = p.match(/^([\w]+):([\w\- ]+)$/)
      if (!match) throw new Error(`include [${p}] is not a valid key or value format`)
      includes.push({ key: match[1], value: match[2] })
    })
    return includes
  }
}
