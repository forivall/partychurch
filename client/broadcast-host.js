import cuid from 'cuid'
import createDebug from 'debug'

import analytics from './analytics'
import createCameraPreview from './camera-preview'
import captureFrames from './capture-frames'
import createCharCounter from './char-counter'
import EventSubscriber from './event-subscriber'
import initProgressSpinner from './progress'

import BroadcastBase from './broadcast-base'

const debug = createDebug('partychurch:chat')

// TODO: finish

export class BroadcastHost extends BroadcastBase {
  constructor(io) {
    super()

    // TODO: show picture in picture of current broadcast in bottom right corner of preview
    // on click, swap

    this._bindHandlers([
      'onSubmitBroadcast',
      'onAckBroadcast',
    ])

    this.io = io

    this.progressSpinner = initProgressSpinner(
      document.querySelector('.progress')
    )

    this.messageInput = document.querySelector('#broadcast-message')

    this.sendButton = document.querySelector('#send')
    this.charCounter = createCharCounter(
      this.messageInput,
      document.querySelector('#char-counter'),
      250
    )

    this.awaitingAck = null
    this.sendTime = 0

    this.broadcastForm = document.querySelector('#broadcast-form')
    this.listenTo(this.broadcastForm, 'submit', this.onSubmitBroadcast)

    this.cameraPreview = createCameraPreview(
      document.querySelector('#broadcast-preview').parentNode
    )

    this.autoListen(this.io, [
      'ackBroadcast',
    ])
  }

  destroy() {
    this._disposed = true
    super.destroy()

    this.charCounter.destroy()
    this.cameraPreview.destroy()
  }

  onSubmitBroadcast(event) {
    event.preventDefault()

    if (this.awaitingAck) return

    const messageText = this.messageInput.value
    this.messageInput.readOnly = true
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

  onAckBroadcast(ack) {
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
}

export default function initBroadcastHost(io) {
  return new BroadcastHost(io)
}
