'use strict'
const { v4: uuidv4 } = require('uuid')

exports.command = 'uuid'

exports.describe = 'Generate a UUID'

exports.builder = (yargs) => {
  return yargs
}

exports.handler = function (argv) {
  console.log(uuidv4())
}
