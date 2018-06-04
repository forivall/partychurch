#!/usr/bin/env ts-node

import * as path from 'path'
import {promisify} from 'util'

// `tsc` complains without this
import {IncomingMessage, Server, ServerResponse} from 'http'
export {IncomingMessage, Server, ServerResponse}

import fastify = require('fastify')
import fstatic = require('fastify-static')
import socketIO = require('socket.io')

interface FastifyReplyExt extends fastify.FastifyReply<ServerResponse> {
  sendFile(filePath: string): this
}

export default async function createServer(options?: fastify.ServerOptions) {
  const app = fastify(options)

  const io = socketIO(app.server)

  io.on('connection', (socket) => {
    app.log.info('socket.io connection')
  })

  // TODO: dev only
  const webpackMiddleware = await import('webpack-dev-middleware')
  const webpackCompiler = await import('webpack')
  const webpackConfig = (await import('../../webpack.config')).default
  const compiler = webpackCompiler(webpackConfig)
  const webpack = webpackMiddleware(compiler, {
    // logger: app.log as any,
    publicPath: webpackConfig.output!.publicPath!,
  })

  app.use(webpack)

  app.register(fstatic, {
    root: path.join(__dirname, '../..'),
  })

  // TODO: production mode
  // tslint:disable-next-line:variable-name
  app.get('/', (req, res_) => {
    const res = res_ as FastifyReplyExt
    res.sendFile('index.html')
  })

  return Object.assign(app, {io})
}

export interface Env extends NodeJS.ProcessEnv {
  PORT: string
}

export function checkEnv(env: NodeJS.ProcessEnv): Env {
  return {
    PORT: '8080',
    ...env,
  }
}

export async function start() {
  // TODO: use fastify-env instead
  const env = checkEnv(process.env)

  const server = await createServer({
    logger: true,
  })
  await promisify((cb: (err: Error) => void) =>
    server.listen(Number(env.PORT), cb),
  )()

  server.log.info(`Server started on ${env.PORT}`)
}

if (require.main === module) {
  start().catch((err) => {
    // tslint:disable-next-line:no-console
    console.error(err.stack || err)
    process.exitCode = 1
  })
}
