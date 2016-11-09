
/**
 * Helper for subscriptions.
 *
 * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
 * @param {String} event name
 * @param {Function} callback
 * @api public
 */

export default class EventSubscriber {
  constructor() {
    this.subs = []
  }
  listenTo(obj, ev, fn) {
    obj.on(ev, fn)
    this.subs.push(() => ({
      destroy() {
        obj.removeListener(fn)
      }
    }))
  }
  destroy() {
    while (this.subs.length > 0) {
      this.subs.pop().destroy()
    }
  }
}
