import cuid from 'cuid'
import createDebug from 'debug'

import analytics from './analytics'
import createCameraPreview from './camera-preview'
import captureFrames from './capture-frames'
import createCharCounter from './char-counter'
import EventSubscriber from './event-subscriber'
import initMessageList from './message'
import initProgressSpinner from './progress'

const debug = createDebug('partychurch:chat')

export class Chat extends EventSubscriber {
  constructor(io, notificationCounter, muteSet) {
    super()

    this._bindHandlers([
      'onSubmitMessage',
      'onAck',
      'onChat',
    ])

    this.io = io
    this.notificationCounter = notificationCounter

    this.progressSpinner = initProgressSpinner(
      document.querySelector('.progress')
    )

    this.messageList = initMessageList(
      document.querySelector('#message-list'),
      muteSet,
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

    this.messageForm = document.querySelector('#message-form')
    this.listenTo(this.messageForm, 'submit', this.onSubmitMessage)

    this.cameraPreview = createCameraPreview(
      document.querySelector('#preview').parentNode
    )

    this.autoListen(this.io, [
      'ack',
      'chat'
    ])
  }

  destroy() {
    this._disposed = true
    super.destroy()

    this.messageList.destroy()
    this.charCounter.destroy()
    this.cameraPreview.destroy()
  }

  onSubmitMessage(event) {
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
      this.io.emit('chat', message, frames)
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
        debug('Error: ' + ack.err)
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
}

export default function initChat(io, notificationCounter, muteSet) {
  return new Chat(io, notificationCounter, muteSet)
}
