import { expect } from 'chai'

import exclude from '../cli/lib/option_exclude.js'

describe('exclude function', () => {
  describe('coerce method', () => {
    it('should parse valid key:value pairs', () => {
      const input = 'key1:value1,key2:123'
      const result = exclude.coerce(input)
      expect(result).to.deep.equal([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 123 }
      ])
    })

    it('should deal with boolean', () => {
      const input = 'key1:true,key2:false'
      const result = exclude.coerce(input)
      expect(result).to.deep.equal([
        { key: 'key1', value: true },
        { key: 'key2', value: false }
      ])
    })

    it('should throw an error for invalid format', () => {
      const input = 'invalidFormat'
      expect(() => exclude.coerce(input)).to.throw('not a valid key or value format')
    })

    it('should throw an error for non-string input', () => {
      const input = null
      expect(() => exclude.coerce(input)).to.throw('--exclude requires key:value pair(s)')
    })

    // Additional test cases...
  })
})
