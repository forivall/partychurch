import createDebug from 'debug'
import events from 'events'

const debug = createDebug('partychurch:eventSubscriber')

const {EventEmitter} = events

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.substring(1)
}

class EventEmitterListener {
  constructor(emitter, ev, fn, options) {
    this.emitter = emitter
    this.eventName = ev
    this.listener = fn
  }
  destroy() {
    const result = this.emitter.removeListener(this.eventName, this.listener)
    this.emitter = null
    this.listener = null
    return result
  }
}

class EventTargetListener {
  constructor(target, ev, fn, options) {
    this.target = target
    this.eventName = ev
    this.listener = fn
    this.options = options
  }
  destroy() {
    const result = this.target.removeEventListener(this.eventName, this.listener)
    this.target = null
    this.listener = null
    this.options = null
    return result
  }
}

export default class EventSubscriber extends EventEmitter {
  constructor() {
    super()
    this.subs = []
  }
  listenTo(obj, ev, fn, options) {
    debug('listening to %s', ev)
    let result
    fn = fn.bind(this)
    if (obj instanceof window.EventTarget) {
      obj.addEventListener(ev, fn, options)
      result = new EventTargetListener(obj, ev, fn, options)
    } else {
      result = obj.on(ev, fn)
      if (result === obj) {
        result = new EventEmitterListener(obj, ev, fn)
      }
    }
    this.subs.push(result)
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
