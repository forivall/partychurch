import createDebug from 'debug'
import page from 'page'
import createClient from 'socket.io-client'

import EventSubscriber from './event-subscriber'
import initChat from './chat'
import initBroadcastHost from './broadcast-host'
// import initBroadcastPane from './broadcast'

const debug = createDebug('partychurch:room')

export class Room extends EventSubscriber {
  constructor(name, app) {
    super()
    this._bindHandlers([
      'onSubmitMessage',
      'onAck',
      'onChat',
      // 'onBroadcast',
      // 'onBroadcaster',
      'onActive',
    ])

    this.name = name
    this.io = createClient(`/room/${this.name}`)

    this.activeUsers = app.activeUsers

    this.autoListen(this.io, [
      'active',
    ])

    debug('connecting')
    if (this.io.connected) {
      this.join('jpg')
    } else {
      this.listenTo(this.io, 'connect', this.join.bind(this))
    }

    this.chat = initChat(this.io, app.notificationCounter, app.muteSet)

    // this.broadcastPane = initBroadcastPane(
    //   document.querySelector('#broadcast-pane'),
    //   this.cameraPreview
    // )
    if (window.user.isHost) {
      this.broadcastHostPane = initBroadcastHost(this.io)
    }
  }

  destroy() {
    this._disposed = true
    super.destroy()

    this.activeUsers = null
  }

  join() {
    debug('join')
    this.io.emit('join', 'jpg')
  }

  leave(msg = {}) {
    debug('leave %s', this.name)
  }

  onActive(numActive) {
    this.activeUsers.count = numActive
  }

  // onBroadcast(broadcast) {
  //   this.broadcastPane.onBroadcast(broadcast)
  // }
  //
  // onBroadcaster(broadcaster) {
  //   this.broadcastPane.onBroadcaster(broadcaster)
  // }
}

export function allowed(ctx, next) {
  const app = ctx.app
  app.onjoin = (exists) => {
    app.onjoin = Function.prototype
    if (!exists) {
      page.show('/', {message: 'room doesn\'t exist'})
      return
    }
    next()
  }
  app.io.emit('joinroom', ctx.params.room)
}

export function enter(ctx, next) {
  ctx.room = new Room(ctx.params.room, ctx.app)
}

export function exit(ctx, next) {
  if (ctx.room) {
    ctx.room.leave(ctx)
    ctx.room = (ctx.room.destroy(), null)
  }
  next()
}
