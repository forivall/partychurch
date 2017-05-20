import createDebug from 'debug'

const debug = createDebug('partychurch:eventSubscriber')

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.substring(1)
}
function uncapitalize(s) {
  return s.charAt(0).toLowerCase() + s.substring(1)
}

export default class EventSubscriber {
  constructor() {
    this.subs = []
  }
  listenTo(obj, ev, fn) {
    debug('listening to %s', ev)
    this.subs.push(obj.on(ev, fn))
  }
  autoListen(obj, evs, prefix = 'on') {
    return evs.map((ev) => {
      const fn = this[prefix + capitalize(ev)]
      return this.listenTo(obj, ev, fn)
    })
  }
  destroy() {
    while (this.subs.length > 0) {
      this.subs.pop().destroy()
    }
  }

  _bindHandler(handler) {
    let key = null
    if (typeof handler === 'string') {
      key = handler
      handler = this[key]
    }
    const boundHandler = function() {
      if (this._disposed) return null
      return handler.apply(this, arguments)
    }.bind(this)
    if (key != null) {
      this[key] = boundHandler
    }
    return boundHandler
  }

  _bindHandlers(handlers) {
    if (handlers === undefined) handlers = this.constructor._handlers
    return handlers.map(this._bindHandler.bind(this))
  }
}
