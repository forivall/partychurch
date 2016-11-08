import crypto from 'crypto'
import tokenthrottle from 'tokenthrottle'

import ChatRoom from './chat-room'

export default class ChatSockets {
  constructor(io, userIdKey, ffmpegRunner, roomOptions) {
    this.connectThrottle = this.connectThrottle.bind(this)
    this.handleConnection = this.handleConnection.bind(this)

    this.io = io
    this.userIdKey = userIdKey
    this.ffmpegRunner = ffmpegRunner
    this.userIdMap = new WeakMap()

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

    this.io.use(this.connectThrottle)

    this.io.on('connection', this.handleConnection)
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
    socket
    .on('join', roomName => this.handleJoin(socket, roomName))
    .on('fingerprint', fingerprint => this.handleFingerprint(socket, fingerprint))
  }

  handleJoin(socket, roomName) {
    const room = this.rooms[roomName]
    if (room) {
      room.handleJoin(socket)
    } else {
      socket.emit('nak', {roomName})
    }
  }

  handleFingerprint(socket, fingerprint) {
    if (this.userIdMap.has(socket)) {
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
    this.userIdMap.set(socket, id)
    socket.emit('userid', id)
  }
}
