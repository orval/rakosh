import { use, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import * as td from 'testdouble'

use(chaiAsPromised)
global.expect = expect
global.td = td

export const mochaHooks = {
  afterEach () {
    td.reset()
  }
}
