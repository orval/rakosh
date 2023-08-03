'use strict'
exports.include = {
  description: 'Only include nuggets with these "[key:value]" pairs; only word chars are allowed',
  alias: 'i',
  string: true,
  coerce: inc => {
    if (!inc || typeof inc !== 'string') {
      throw new Error('--include requires key:value pair(s)')
    }
    const includes = []
    inc.split(',').forEach(p => {
      const match = p.match(/^([\w]+):([\w\- ]+)$/)
      if (!match) throw new Error(`include [${p}] is not a valid key or value format`)
      const num = Number(match[2])
      includes.push({ key: match[1], value: (isNaN(num)) ? match[2] : num })
    })
    return includes
  }
}
