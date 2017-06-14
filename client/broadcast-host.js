import cuid from 'cuid'
import createDebug from 'debug'

import analytics from './analytics'
import createCameraPreview from './camera-preview'
import captureFrames from './capture-frames'
import createCharCounter from './char-counter'
import initProgressSpinner from './progress'

import AbstractBroadcast from './broadcast-abstract'

const debug = createDebug('partychurch:chat')

// TODO: finish

export class BroadcastHost extends AbstractBroadcast {
  constructor(io) {
    const root = document.querySelector('.broadcast-host-video')
    super(root)

    // TODO: show picture in picture of current broadcast in bottom right corner of preview
    // on click, swap

    this._bindHandlers([
      'onSubmitBroadcast',
      'onAckBroadcast',
    ])

    this.io = io

    this.progressSpinner = initProgressSpinner(
      root.querySelector('.progress')
    )

    this.messageInput = root.querySelector('#broadcast-message')

    // TODO: bind the tieout buttons

    this.recordButton = root.querySelector('#record-button')

    this.awaitingAck = null
    this.sendTime = 0

    this.broadcastForm = root.querySelector('#broadcast-form')
    this.listenTo(this.broadcastForm, 'submit', this.onUpdateTitle)
    this.listenTo(this.broadcastForm, 'submit', this.onUpdateTitle)

    this.cameraPreview = createCameraPreview(
      root.querySelector('#broadcast-preview').parentNode
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

  onUpdateTitle(event) {
    event.preventDefault()

    this.io.emit('broadcast', {
      title: this.messageInput.no
    })
  }

  onSubmitBroadcast(event) {
    event.preventDefault()

    if (this.awaitingAck) return

    const messageText = this.messageInput.value
    this.messageInput.readOnly = true
    this.recordButton.setAttribute('disabled', true)
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
      this.recordButton.removeAttribute('disabled')

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
