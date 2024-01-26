'use strict'
import { v4 as uuidv4 } from 'uuid'

export default {
  command: 'uuid',
  describe: 'Generate a UUID',
  builder: (yargs) => {
    return yargs
  },
  handler: (argv) => {
    console.log(uuidv4())
  }
}
