import { expect } from 'chai'
// import * as td from 'testdouble'

import { Nugget } from '../cli/lib/nugget.js'

describe('Nugget', function () {
  const base = { _key: '123', fspath: 'path/to/file' }

  describe('constructor', function () {
    it('should throw an error if no _key attribute is provided', function () {
      expect(() => new Nugget({})).to.throw(Error, 'no _key attribute in Nugget')
    })

    it('should throw an error if no fspath attribute is provided', function () {
      expect(() => new Nugget({ _key: 'x' })).to.throw(Error, 'no fspath attribute in Nugget')
    })

    it('should throw an error if type is wrong', () => {
      expect(() => new Nugget({ ...base, type: 'foo' })).to.throw(Error, 'Unknown Nugget type')
    })

    it('should throw an error if the media type is unknown', () => {
      expect(() => new Nugget({ ...base, __media: { type: 'foo', path: 'x'} })).to.throw(Error, 'Unknown media type')
    })
  })

  describe('getLabel', function () {
    it('should return the label from body if no label attribute is present', function () {
      const attributes = { _key: '123', fspath: 'path/to/file' }
      const body = '# Test Label\nSome content here'
      const nugget = new Nugget(attributes, body)
      expect(nugget.getLabel()).to.equal('Test Label')
    })

    // Add more getLabel tests here
  })

  // Add more test cases for other methods of Nugget class
})
