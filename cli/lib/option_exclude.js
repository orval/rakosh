'use strict'
exports.exclude = {
  description: 'Exclude nuggets with these "[key:value]" pairs; only word chars are allowed',
  string: true,
  coerce: exc => {
    if (!exc) throw new Error('--exclude requires key:value pair(s)')
    const excludes = []
    exc.split(',').forEach(p => {
      const match = p.match(/^([\w]+):([\w\- ]+)$/)
      if (!match) throw new Error(`exclude [${p}] is not a valid key or value format`)
      excludes.push({ key: match[1], value: match[2] })
    })
    return excludes
  }
}