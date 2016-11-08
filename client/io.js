import createSocketIoClient from 'socket.io-client'

const io = createSocketIoClient()

export default io

export class EventSubscriber {
  constructor() {
    this.subs = []
  }
  listenTo(io, ...args) {
    this.subs.push(io.on(...args))
  }
  destroy() {
    while (this.subs.length > 0) {
      this.subs.pop().destroy()
    }
  }
}
