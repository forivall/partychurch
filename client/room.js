import cuid from 'cuid'

import analytics from './analytics'
import createCameraPreview from './camera-preview'
import captureFrames from './capture-frames'
import createCharCounter from './char-counter'
import io, {EventSubscriber} from './io'
import initMessageList from './message'
import initProgressSpinner from './progress'

export class Room extends EventSubscriber {
  constructor(name, app) {
    super()
    this.onSubmitForm = this.onSubmitForm.bind(this)
    this.onAck = this._bindHandler(this.onAck)
    this.onChat = this._bindHandler(this.onChat)
    this.onActive = this._bindHandler(this.onActive)

    this.name = name

    this.activeUsers = app.activeUsers
    this.notificationCounter = app.notificationCounter

    this.progressSpinner = initProgressSpinner(
      document.querySelector('.progress')
    )

    this.messageList = initMessageList(
      document.querySelector('#message-list'),
      app.muteSet,
      analytics
    )

    this.messageInput = document.querySelector('#message')
    this.messageInput.readOnly = true

    this.sendButton = document.querySelector('#send')
    this.charCounter = createCharCounter(
      this.messageInput,
      document.querySelector('#char-counter'),
      250
    )

    this.awaitingAck = null
    this.sendTime = 0

    this.messageForm = document.querySelector('form')
    this.messageForm.addEventListener('submit', this.onSubmitForm)

    this.listenTo(io, 'ack', this.onAck)
    this.listenTo(io, 'chat', this.onChat)
    this.listenTo(io, 'active', this.onActive)

    if (io.connected) {
      this.join()
    } else {
      this.listenTo(io, 'connect', this.join.bind(this))
    }

    this.cameraPreview = createCameraPreview(
      document.querySelector('#preview').parentNode, analytics
    )
  }

  destroy() {
    this._disposed = true
    super.destroy()

    this.activeUsers = null
    this.messageList.destroy()
    this.charCounter.destroy()
    this.messageForm.removeEventListener('submit', this.onSubmitForm)
    this.cameraPreview.destroy()
  }

  _bindHandler(handler) {
    return function() {
      if (this._disposed) return null
      return handler.apply(this, arguments)
    }.bind(this)
  }

  join() {
    io.emit('join', this.name)
  }

  onSubmitForm(event) {
    event.preventDefault()

    if (this.awaitingAck) return

    const messageText = this.messageInput.value
    this.sendButton.setAttribute('disabled', true)
    this.awaitingAck = cuid()
    this.progressSpinner.setValue(0).show()

    captureFrames(document.querySelector('#preview'), {
      format: 'image/jpeg',
      width: 200,
      height: 150
    }, (err, frames) => {
      setTimeout(() => {
        this.progressSpinner.hide()
        setTimeout(() => this.progressSpinner.setValue(0), 400)
      }, 400)

      this.messageInput.value = ''
      this.messageInput.readOnly = false
      this.sendButton.removeAttribute('disabled')

      if (err) {
        this.awaitingAck = null
        // TODO(tec27): show to user
        analytics.onMessageCaptureError(err.message)
        console.error(err)
        return
      }

      const message = {
        text: messageText,
        format: 'image/jpeg',
        ack: this.awaitingAck
      }
      io.emit('chat', message, frames)
      this.sendTime = Date.now()
      // fire 'change'
      const event = document.createEvent('HTMLEvents')
      event.initEvent('change', false, true)
      this.messageInput.dispatchEvent(event)
    }).on('progress', percentDone => this.progressSpinner.setValue(percentDone))
  }

  onAck(ack) {
    if (this.awaitingAck && this.awaitingAck === ack.key) {
      const timing = Date.now() - this.sendTime
      this.awaitingAck = null
      if (ack.err) {
        // TODO(tec27): display to user
        console.log('Error: ' + ack.err)
        analytics.onMessageSendError('' + ack.err, timing)
      } else {
        analytics.onMessageSent(timing)
      }
    }
  }

  onChat(chat) {
    const autoScroll = window.pageYOffset + window.innerHeight + 32 > document.body.clientHeight
    const message = this.messageList.addMessage(chat, autoScroll)
    if (message && autoScroll) {
      message.elem.scrollIntoView()
    }

    if (message && document.hidden) {
      this.notificationCounter.unreadMessages++
    }
  }
  onActive(numActive) {
    this.activeUsers.count = numActive
  }
}

export function enter(ctx, next) {
  ctx.room = new Room(ctx.params.room, ctx.app)
  next()
}

export function exit(ctx, next) {
  ctx.room = (ctx.room.destroy(), null)
  next()
}
