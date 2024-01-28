import { expect } from 'chai'
import * as td from 'testdouble'

import { Media } from '../cli/lib/media.js'

describe('Media class', function () {
  describe('Static properties', function () {
    it('should have correct MIME type values', function () {
      expect(Media.MARKDOWN).to.equal('text/markdown; charset=UTF-8')
      expect(Media.PNG).to.equal('image/png')
      expect(Media.GIF).to.equal('image/gif')
      expect(Media.JPEG).to.equal('image/jpeg')
    })
  })

  describe('Constructor', function () {
    let fs

    beforeEach(async () => {
      fs = await td.replaceEsm('node:fs')
    })

    it('should create a Media object with valid arguments', () => {
      td.when(fs.readFileSync(td.matchers.anything())).thenReturn('wibble')
      const media = new Media('test/foo.md', { path: 'foo.png', type: Media.PNG })
      expect(media).to.be.an.instanceOf(Media)
    })

    it('should throw an error if path/type is missing', () => {
      expect(() => new Media('x', { type: Media.PNG })).to.throw('No path attribute in Media')
      expect(() => new Media('x', { path: 'x' })).to.throw('No type attribute in Media')
    })

    it('should throw an error with an unsupported type', () => {
      expect(() => new Media('x', { path: 'x', type: 'abc' })).to.throw('Unknown media type')
    })
  })
})
