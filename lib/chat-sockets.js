import crypto from 'crypto'
import createDebug from 'debug'
import tokenthrottle from 'tokenthrottle'

import ChatRoom from './chat-room'

const debug = createDebug('partychurch:chat-sockets')

const DEVELOPMENT = process.env.NODE_ENV === 'development'

export default class ChatSockets {
  constructor(io, userIdKey, ffmpegRunner, roomOptions) {
    this.connectThrottle = this.connectThrottle.bind(this)
    this.handleConnection = this.handleConnection.bind(this)

    this.io = io
    this.nsp = io.of('/home')
    this.userIdKey = userIdKey
    this.ffmpegRunner = ffmpegRunner
    this.userIdMap = new WeakMap()
    this.userIdHasReloaded = {}

    this.rooms = Object.create(null)
    this.rooms.meat = new ChatRoom(this, 'meat', roomOptions)

    // throttle for connections (per host)
    this._connectThrottle = tokenthrottle({
      rate: 3,
      burst: 30,
      window: 60 * 1000,
    })
    // throttle for message sending (per socket)
    this._messageThrottle = tokenthrottle({
      rate: 6,
      burst: 18,
      window: 60 * 1000,
    })

    // TODO(forivall): make this properly apply to namespaces
    this.io.use(this.connectThrottle)

    this.nsp.on('connection', this.handleConnection)
  }

  connectThrottle(socket, next) {
    let address = socket.conn.remoteAddress
    if (socket.request.headers['x-forwarded-for']) {
      address = socket.request.headers['x-forwarded-for'].split(/ *, */)[0]
    }

    this._connectThrottle.rateLimit(address, (err, limited) => {
      if (err) {
        console.error('Error checking rate limit for connection: ', err)
        next()
        return
      }
      if (limited) {
        next(new Error('Exceeded connection limit'))
        return
      }

      next()
    })
  }

  handleConnection(socket) {
    debug('connection', socket.nsp.name)
    socket
    .on('fingerprint', fingerprint => this.handleFingerprint(socket, fingerprint))
    .on('joinroom', roomName => this.handleJoin(socket, roomName))
  }

  handleJoin(socket, roomName) {
    debug(`join ${roomName}`)
    socket.emit('joinroom', Boolean(this.rooms[roomName]))
  }

  handleFingerprint(socket, fingerprint) {
    if (this.userIdMap.has(socket.client)) {
      socket.emit('error', 'fingerprint already set')
      return
    }
    if (!fingerprint || fingerprint.length > 100) {
      socket.emit('error', 'invalid fingerprint')
      socket.disconnect()
      return
    }

    this.setFingerprintForSocket(socket, fingerprint)
  }

  setFingerprintForSocket(socket, specified) {
    const id = crypto.createHash('md5').update(specified + this.userIdKey).digest('hex')
    this.userIdMap.set(socket.client, id)
    socket.emit('userid', id)
    if (DEVELOPMENT && !this.userIdHasReloaded[id]) {
      this.userIdHasReloaded[id] = true
      socket.emit('reload')
    }
  }
}
