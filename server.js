import express from 'express'
import http from 'http'
import https from 'https'
import path from 'path'
import fs from 'fs'
import socketIo from 'socket.io'
import browserify from 'browserify-middleware'
import createDebug from 'debug'
import bundleCollapser from 'bundle-collapser/plugin'
import pugify from 'pugify'
import serveStatic from 'serve-static'
import stylus from 'stylus'
import serveCss from './lib/serve-css'
import canonicalHost from 'canonical-host'
import userCounter from './lib/user-counter'
import createFfmpegRunner from './lib/ffmpeg-runner'
import ChatSockets from './lib/chat-sockets'
import config from './conf.json'

import {BLANK_IMAGE} from './client/constants'

const debug = createDebug('partychurch:server')

const userIdKey = config.idKey
if (!userIdKey) {
  throw new Error('idKey must be specified in conf.json!')
}

const app = express()
app
  .set('x-powered-by', false)
  .set('view engine', 'pug')

const servers = []
let httpServer
let listenPort

if (config.sslCert) {
  if (!config.sslKey || !config.sslCaBundle || !config.canonicalHost || !config.sslPort) {
    throw new Error('sslCert, sslKey, sslCaBundle, sslPort, and canonicalHost must all be ' +
        'configured for SSL support.')
  }

  const caList = []
  const curCert = []
  const caFile = fs.readFileSync(path.join(__dirname, config.sslCaBundle), 'utf8')
  for (const line of caFile.split('\n')) {
    if (!line.length) continue

    curCert.push(line)
    if (line.match(/-END CERTIFICATE-/)) {
      caList.push(curCert.join('\n'))
      curCert.length = 0
    }
  }
  curCert.length = 0

  const sslCert = fs.readFileSync(path.join(__dirname, config.sslCert), 'utf8')
  const sslKey = fs.readFileSync(path.join(__dirname, config.sslKey), 'utf8')

  httpServer = https.createServer({
    ca: caList,
    cert: sslCert,
    key: sslKey
  }, app)
  listenPort = config.sslPort

  const canon = canonicalHost(config.canonicalHost, 301)
  const redirector = http.createServer(function(req, res) {
    if (canon(req, res)) return
    res.statusCode = 400
    res.end('Bad request\n')
  })
  servers.push(redirector)

  redirector.listen(config.port)
} else {
  httpServer = http.Server(app)
  listenPort = config.port
}
servers.push(httpServer)

const io = socketIo(httpServer)

app.use(require('cookie-parser')())

const pugPlugin = pugify.pug({
  pretty: !process.env.NODE_ENV === 'production',
  compileDebug: !process.env.NODE_ENV === 'production'
})

const browserifyOpts = {
  plugins: [{
    plugin(b, opts) {
      b.transform(pugPlugin)
    }
  }]
}
const PRODUCTION = process.env.NODE_ENV === 'production'
if (PRODUCTION) {
  browserifyOpts.plugins.push({ plugin: bundleCollapser })
}

function setTemplateVars(req, res, next) {
  req.templateVars = {
    theme: req.cookies.theme,
    trackingId: config.gaTrackingId,
    BLANK_IMAGE,
  }
  next()
}

app.use(stylus.middleware({
  src: path.join(__dirname, 'styl'),
  dest: path.join(__dirname, 'tmp'),
  compile(str, path) {
    debug('styl compile!')
    const s = stylus(str)
    .set('filename', path)
    if (!PRODUCTION) {
      s
      .render((err, css) => {
        if (err) console.error(err.message || err)
      })
    }
    return s
  }
}))

if (app.get('env') === 'development') {
  const browserSync = require('browser-sync')

  const bs = browserSync.create().init({ logSnippet: false })

  app.use(require('connect-browser-sync')(bs))
}

app.get('/client.js', browserify(__dirname + '/client/index.js', browserifyOpts))
app.get('/styles.css', serveCss(__dirname + '/tmp/styles.css'))

// TODO: use pug-linker directly to include child pug templates
app.get('/', setTemplateVars, (req, res) => {
  res.render('index', req.templateVars)
})

app.use(serveStatic('public'))

app.get('/:room', setTemplateVars, (req, res) => {
  Object.assign(req.templateVars, {
    isNew: true,
    hostFingerprint: null,
  })
  res.render('room', req.templateVars)
})

const readyPromise = new Promise((resolve, reject) => {
  userCounter(io)
  createFfmpegRunner((err, runner) => {
    if (err) {
      throw err
    }

    // eslint-disable-next-line no-unused-vars
    const chat = new ChatSockets(io, userIdKey, runner, {
      historyLimit: 15,
      historyExpiryMs: 10 * 60 * 1000,
      expiryGainFactor: 1.2548346 /* calculated so last message =~ 6 hours */
    })

    httpServer.listen(listenPort, function() {
      const host = httpServer.address().address
      const port = httpServer.address().port
      console.log('Listening at http%s://%s:%s', config.sslCert ? 's' : '', host, port)
      resolve()
    })
  })
})

export default {
  io,
  servers,
  readyPromise,
}
