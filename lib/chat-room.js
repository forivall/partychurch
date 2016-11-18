import crypto from 'crypto'
import fs from 'fs'
import cuid from 'cuid'
import createDebug from 'debug'
import twitterText from 'twitter-text'
import generatePassword from 'password-generator'

import EventSubscriber from './event-subscriber'
import frameConverter from './frame-converter'
import mimeTypes from './mime-types'
import userCounter from './user-counter'

const debug = createDebug('partychurch:chat-room')

// TODO(forivall): move this to a standalone module
// Helps protect against ImageMagick abuse
// Magic values taken from https://en.wikipedia.org/wiki/List_of_file_signatures
function verifyJpegHeader(buffer) {
  if (buffer.length < 12) {
    return false
  }

  const firstDword = buffer.readUInt32BE(0)
  if ((firstDword & 0xFFFFFF00) >>> 0 !== 0xFFD8FF00) {
    return false
  }
  const fourthByte = firstDword & 0xFF
  if (fourthByte === 0xD8) {
    return true
  } else if (fourthByte === 0xE0) {
    const jfif = buffer.readUInt32BE(6)
    const additional = buffer.readUInt16BE(10)
    if (jfif !== 0x4A464946 || additional !== 0x0001) {
      return false
    }
    return true
  } else if (fourthByte === 0xE1) {
    const exif = buffer.readUInt32BE(6)
    const additional = buffer.readUInt16BE(10)
    if (exif !== 0x45786966 || additional !== 0x0000) {
      return false
    }
    return true
  } else {
    return false
  }
}

function transformText(text) {
  const sanitized = text.slice(0, 250).replace(/[\r\n\t]/, '')
  const entities =
      twitterText.extractEntitiesWithIndices(sanitized, { extractUrlsWithoutProtocol: true})
  const linkified = twitterText.autoLinkEntities(sanitized, entities, {
    htmlEscapeNonEntities: true,
    targetBlank: true,
    usernameIncludeSymbol: true,
  })

  return linkified
}

// Build a quick lookup for expiry times (including gain factor), indexed by the number of
// messages in the history when making the check
function buildExpiryTimeLookup(historyLimit, historyExpiryMs, expiryGainFactor) {
  const expiryTimes = [0]
  for (let i = 1; i <= historyLimit; i++) {
    expiryTimes[i] = historyExpiryMs * (expiryGainFactor ** (historyLimit - i))
  }
  return expiryTimes
}

export default class ChatRoom extends EventSubscriber {
  constructor(sockets, name, options) {
    debug('Creating chat room %s', name)
    super()
    this.handleConnection = this.handleConnection.bind(this)

    this.name = name
    this.sockets = sockets
    this.nsp = sockets.io.of(`/room/${this.name}`)
    this.subs.push(userCounter(this.nsp))
    this.historyLimit = options.historyLimit
    this.password = generatePassword(6, false, /[A-Z0-9]/)

    this.broadcaster = null
    const fingerButts = crypto.createHash('md5').update('butts').digest('hex')
    const jpgButts = fs.readFileSync(__dirname + '/../public/butts.jpg')
    this.broadcast = Object.create(null, {
      video: {
        value: {
          data: {
            key: cuid(),
            sent: Date.now(),
            userId: fingerButts,
            frames: 10
          },
          videos: {
            jpg: jpgButts
          }
        },
        enumerable: true
      },
      topic: {value: null, enumerable: true},
      image: {value: null, enumerable: true},
    })

    this.expiryTimes = buildExpiryTimeLookup(
      this.historyLimit,
      options.historyExpiryMs,
      options.expiryGainFactor
    )

    this.history = [{
      chat: this.createChat(fingerButts, 'butts'),
      videos: {
        jpg: jpgButts
      }
    }]

    this.nsp.on('connection', this.handleConnection)
  }

  get io() {return this.sockets.io}
  get ffmpegRunner() {return this.sockets.ffmpegRunner}
  get userIdMap() {return this.sockets.userIdMap}
  get _messageThrottle() {return this.sockets._messageThrottle}

  createChat(userId, text = '', frames = 10) {
    const transformedText = transformText(text)
    return {
      key: cuid(),
      text: transformedText,
      sent: Date.now(),
      userId,
      frames,
      from: 'partychurch',
    }
  }

  handleConnection(socket) {
    debug('connection', socket.nsp.name)
    socket
    .on('join', videoType => this.handleJoin(socket, videoType))
    .on('fingerprint', fingerprint => this.handleFingerprint(socket, fingerprint))
  }

  handleJoin(socket, videoType) {
    debug('join', socket.client.id, videoType)
    socket.join(videoType)
    this.listenTo(socket, 'chat', (message, frames) => this.handleIncoming(socket, message, frames))
    this.listenTo(socket, 'message', message => this.handleIncomingLegacy(socket, message))
    this.listenTo(socket, 'auth', password => this.handleAuth(socket, password))
    this.listenTo(socket, 'broadcast', (item, data) => this.handleBroadcast(socket, item, data))

    this.emitBroadcaster(socket)
    this.sendHistory(socket, videoType)
  }

  sendHistory(socket, videoType) {
    // send current broadcast
    for (const key in this.broadcast) {
      const broadcast = this.broadcast[key]
      if (broadcast === null) continue
      const packet = Object.create(broadcast.data)
      packet.type = key
      const broadcastVideos = broadcast.videos
      debug('emit history broadcast %s %j', key, broadcast.data)
      this.emitBroadcast(socket, packet, broadcastVideos && broadcastVideos[videoType], videoType)
    }

    // send chat history
    const now = Date.now()
    while (this.history.length &&
        now - this.history[0].chat.sent > this.expiryTimes[this.history.length]) {
      this.history.shift()
    }

    for (let i = 0; i < this.history.length; i++) {
      this.emitChatInFormat(
          socket, this.history[i].chat, this.history[i].videos[videoType], videoType)
    }
  }

  addToHistory(chat, videos) {
    debug('added %j to history', chat)
    this.history.push({ chat, videos })
    if (this.history.length > this.historyLimit) {
      this.history.shift()
    }

    this.emitChat(chat, videos)
  }

  handleIncoming(socket, message, frames) {
    if (!this.userIdMap.has(socket.client)) {
      socket.emit('error', 'no fingerprint set')
      return
    }
    const userId = this.userIdMap.get(socket.client)
    debug('Got incoming message from %s', userId)
    if (!message) {
      socket.emit('error', 'invalid message')
      return
    }
    const ack = {
      key: '' + message.ack
    }

    this._messageThrottle.rateLimit(userId, (err, limited) => {
      if (err) {
        console.error('Error ratelimiting message:', err)
      } else if (limited) {
        ack.err = 'exceeded message limit'
        socket.emit('ack', ack)
        return
      }

      // TODO(forivall): allow no frames if the socket is the broadcaster
      // TODO(tec27): allowing variable frame counts should be fairly easy, we should do this
      if (!frames || !Array.isArray(frames) || frames.length > 100 ||
          !frames.every(f => verifyJpegHeader(f))) {
        ack.err = 'invalid frames'
        socket.emit('ack', ack)
        return
      }
      if (!message.format || message.format !== 'image/jpeg') {
        ack.err = 'invalid frame format'
        socket.emit('ack', ack)
        return
      }

      frameConverter(frames, message.format, this.ffmpegRunner, (err, video) => {
        if (err) {
          console.error('error: ' + err)
          ack.err = 'unable to convert frames'
          socket.emit('ack', ack)
          return
        }

        const chat = this.createChat(userId, message.text)
        socket.emit('ack', ack)
        this.addToHistory(chat, video)
      })
    })
  }

  handleAuth(socket, password) {
    if (password === this.password) {
      const old = this.broadcaster
      this.broadcaster = this.userIdMap.get(socket.client)
      debug('new broadcaster %s, (old: %s)', this.broadcaster, old)
      this.emitBroadcaster(this.nsp)
    }
  }

  handleBroadcast(socket, item, data) {

  }

  emitChat(chatData, videos) {
    // TODO(forivall): send mp4 for loooong streamer vids
    // TODO(forivall): send to individual rooms per streamer
    const videoType = 'jpg'
    this.emitChatInFormat(this.nsp.to(videoType), chatData, videos[videoType], videoType)
  }

  emitChatInFormat(target, data, video, videoType) {
    debug('emit chat %j', data)
    target.emit('chat', addVideo(Object.create(data), video, videoType))
  }

  emitBroadcast(target, packet, video, videoType) {
    target.emit('broadcast', addVideo(packet, video, videoType))
  }

  emitBroadcaster(target, fingerprint) {
    target.emit('broadcaster', this.broadcaster)
  }
}

function addVideo(packet, video, videoType) {
  if (video == null) return packet
  packet.video = video
  packet.videoType = videoType
  packet.videoMime = mimeTypes[videoType]
  return packet
}
