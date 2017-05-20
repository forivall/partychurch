import createDebug from 'debug'
import createClient from 'socket.io-client'

import EventSubscriber from './event-subscriber'

const debug = createDebug('partychurch:home')

export class Home extends EventSubscriber {
  constructor(app) {
    super()

    debug('we\'re home!')
    this.io = createClient('/home')

    app.notificationCounter.unreadMessages = 0

    this.listenTo(this.io, 'party', this.onParty)
  }
}

export function enter(ctx, next) {
  console.log('home', ctx.app)
  next()
}

export function exit(ctx, next) {
  console.log('exit home')
  next()
}
