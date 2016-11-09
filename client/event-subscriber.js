export default class EventSubscriber {
  constructor() {
    this.subs = []
  }
  listenTo(obj, ev, fn) {
    this.subs.push(obj.on(ev, fn))
  }
  destroy() {
    while (this.subs.length > 0) {
      this.subs.pop().destroy()
    }
  }
}
