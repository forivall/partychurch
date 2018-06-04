#!/usr/bin/env node

const path = require('path')

const tsNode = require('ts-node')

tsNode.register({
  project: path.join(__dirname, 'tsconfig.json')
})

require('./src/server').start().catch((err) => {
  console.error(err.stack || err)
  process.exitCode = 1
})
