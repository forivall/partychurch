import createDebug from 'debug'
import filmstrip2gif from 'filmstrip2gif'
import analytics from './analytics'
import createCameraPreview from './camera-preview'
import EventSubscriber from './event-subscriber'
import icons from './icons'
import localeTime from './locale-time'
import theme from './theme'
import {BLANK_IMAGE} from './constants'

const debug = createDebug('partychurch:broadcast')

const NUM_VIDEO_FRAMES = 10
const FILMSTRIP_DURATION = 0.92
const FILMSTRIP_HORIZONTAL = false

export default class BroadcastBase extends EventSubscriber {
  constructor(elem, cameraPreview) {
    super()

    this._destroyed = false
    this._userId = null
    this._broadcaster = null
    this._srcUrl = null

    this.elem = elem

    this.previewContainer = this.elem.querySelector('.preview-container')
    this.filmstrip = this.elem.querySelector('.filmstrip')
    this.saveButton = this.elem.querySelector('.save')
    this.chatText = this.elem.querySelector('p')
    this.timestamp = this.elem.querySelector('time')
    // placeholder div so it can be replaced with the real thing when bound
    this.identicon = this.elem.querySelector('.identicon')

    // generate icons where needed
    this.saveButton.appendChild(icons.save('invert'))

    this.saveButton.addEventListener('click', () => this.saveGif())
    theme.on('themeChange', this.refreshIdenticon)
    this.subs.push({destroy() {theme.off('themeChange', this.refreshIdenticon)}})

    this.cameraPreview = createCameraPreview(
      document.querySelector('#broadcast-preview').parentNode, cameraPreview
    )
  }

  onBroadcast(broadcast) {
    const type = broadcast.type
    debug('broadcast %j', broadcast)
    this[`onBroadcast${type[0].toUpperCase()}${type.slice(1)}`](broadcast)
  }

  onBroadcastVideo({sent, userId, from, video, videoMime, videoType}) {
    this._throwIfDestroyed()
    this.clearVideo()

    const blob = new window.Blob([ video ], { type: videoMime })
    this._srcUrl = window.URL.createObjectURL(blob)
    this.filmstrip.src = this._srcUrl

    const sentDate = new Date(sent)
    this.timestamp.datetime = sentDate.toISOString()
    this.timestamp.innerHTML = localeTime(sentDate)

    this._userId = userId
    this.refreshIdenticon()
  }

  clearVideo() {
    this._throwIfDestroyed()

    this._userId = null

    this.filmstrip.src = BLANK_IMAGE

    if (this._srcUrl) {
      window.URL.revokeObjectURL(this._srcUrl)
      this._srcUrl = null
    }
  }

  onBroadcastTopic(broadcast) {
    this.chatText.innerHTML = broadcast.text
  }

  onBroadcastImage(broadcast) {

  }

  destroy() {
    this._throwIfDestroyed()
    this.clearVideo()
    super.destroy()
    this._destroyed = true
  }

  saveGif() {
    this._throwIfDestroyed()
    this.saveButton.disabled = true
    this.trackSaveGif()

    // TODO(forivall) deduplicate this code from messageList
    const cb = (err, gifBlob) => {
      this.saveButton.disabled = false
      if (err) {
        // TODO(tec27): need a good way to display this error to users
        console.error('Error creating GIF:')
        console.dir(err)
        return
      }

      const url = window.URL.createObjectURL(gifBlob)
        , link = document.createElement('a')
        , click = document.createEvent('MouseEvents')

      link.href = url
      link.download = Date.now() + '.gif'
      click.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0,
          false, false, false, false, 0, null)
      link.dispatchEvent(click)
      setTimeout(() => window.URL.revokeObjectURL(url), 100)
    }

    filmstrip2gif(this._srcUrl, FILMSTRIP_DURATION, NUM_VIDEO_FRAMES, FILMSTRIP_HORIZONTAL, cb)
  }

  _throwIfDestroyed() {
    if (this._destroyed) throw new Error('Pane already destroyed!')
  }

  trackSaveGif() {
    // TODO: track if broadcaster or viewer, and if it's a chat message or a broadcast
    analytics.onSaveBroadcastGif()
  }
}
