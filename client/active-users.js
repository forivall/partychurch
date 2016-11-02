export class ActiveUsers {
  constructor() {
    this.elem = document.querySelector('#active-users')
    this._isHidden = false
  }

  hide() {
    this._isHidden = true
    this.elem.innerHTML = ''
    this.elem.title = ''
  }

  show() {
    this._isHidden = false
    this.update()
  }

  get count() {
    return this._count
  }
  set count(count) {
    this._count = count
    if (!this._isHidden) this.update()
  }

  update() {
    const active = this._count
    if (this._count > 0) {
      this.elem.innerHTML = '' + active
      this.elem.title = `${active} active users`
    } else {
      this.elem.innerHTML = '?'
      this.elem.title = 'not connected'
    }
  }
}

export default function createActiveUsers() {
  return new ActiveUsers(...arguments)
}
