'use strict'
const include = {
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
      includes.push({ key: match[1], value: getValue(match[2]) })
    })
    return includes
  }
}

function getValue (str) {
  // true & false get converted to boolean
  if (str === 'true' || str === 'false') return str === 'true'

  const num = Number(str)
  return isNaN(num) ? str : num
}

export default include
