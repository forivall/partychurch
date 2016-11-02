import createAbout from './about'
import analytics from './analytics'
import createDropdown from './dropdown'
import getFingerprint from './fingerprint'
import io from './io'
import NotificationCounter from './notification-counter'
import * as room from './room'
import StoredSet from './stored-set'
import theme from './theme'
import transitionEvent from './transition-event'

const app = {
  muteSet: new StoredSet('mutes'),
  clientId: null
}

let active = 0
io.on('connect', function() {
  io.emit('fingerprint', getFingerprint())
  io.emit('join', 'jpg')
}).on('disconnect', function() {
  active = 0
  updateActiveUsers()
})

io.on('userid', function(id) {
  app.clientId = id
  if (app.messageList) app.messageList.clientId = id
})

const notificationCounter = new NotificationCounter()
io.on('chat', function(chat) {
  const autoScroll = window.pageYOffset + window.innerHeight + 32 > document.body.clientHeight
  const message = messageList.addMessage(chat, autoScroll)
  if (message && autoScroll) {
    message.elem.scrollIntoView()
  }

  if (message && document.hidden) {
    notificationCounter.unreadMessages++
  }
}).on('active', function(numActive) {
  active = numActive
  updateActiveUsers()
})

function updateActiveUsers() {
  const elem = document.querySelector('#active-users')
  if (active > 0) {
    elem.innerHTML = '' + active
    elem.title = `${active} active users`
  } else {
    elem.innerHTML = '?'
    elem.title = 'not connected'
  }
}

createDropdown(document.querySelector('header .dropdown'), {
  logout: () => {
    console.log('todo')
  },
  unmute: () => {
    muteSet.clear()
    analytics.onUnmute()
  },
  changeTheme: () => {
    const newTheme = theme.isDark() ? 'light' : 'dark'
    theme.setTheme(newTheme)
    analytics.onChangeTheme(newTheme)
  },
  about: () => {
    showAbout()
    analytics.onShowAbout()
  },
})

const updateTheme = newTheme => {
  document.body.classList.toggle('dark', newTheme === 'dark')
  const otherTheme = newTheme === 'light' ? 'dark' : 'light'
  document.querySelector('#change-theme').textContent = `Use ${otherTheme} theme`
}

theme.on('themeChange', updateTheme)
updateTheme(theme.getTheme())

const messageInput = document.querySelector('#message')
const sendButton = document.querySelector('#send')
let awaitingAck = null
let sendTime = 0

createCharCounter(messageInput, document.querySelector('#char-counter'), 250)

document.querySelector('form').addEventListener('submit', function(event) {
  event.preventDefault()

  if (awaitingAck) return

  const messageText = messageInput.value
  messageInput.readOnly = true
  sendButton.setAttribute('disabled', true)
  awaitingAck = cuid()
  progressSpinner.setValue(0).show()

  captureFrames(document.querySelector('#preview'), {
    format: 'image/jpeg',
    width: 200,
    height: 150
  }, function(err, frames) {
    setTimeout(() => {
      progressSpinner.hide()
      setTimeout(() => progressSpinner.setValue(0), 400)
    }, 400)

    messageInput.value = ''
    messageInput.readOnly = false
    sendButton.removeAttribute('disabled')

    if (err) {
      awaitingAck = null
      // TODO(tec27): show to user
      tracker.onMessageCaptureError(err.message)
      console.error(err)
      return
    }

    const message = {
      text: messageText,
      format: 'image/jpeg',
      ack: awaitingAck
    }
    io.emit('chat', message, frames)
    sendTime = Date.now()
    // fire 'change'
    const event = document.createEvent('HTMLEvents')
    event.initEvent('change', false, true)
    messageInput.dispatchEvent(event)
  }).on('progress', percentDone => progressSpinner.setValue(percentDone))
})

io.on('ack', function(ack) {
  if (awaitingAck && awaitingAck === ack.key) {
    const timing = Date.now() - sendTime
    awaitingAck = null
    if (ack.err) {
      // TODO(tec27): display to user
      console.log('Error: ' + ack.err)
      tracker.onMessageSendError('' + ack.err, timing)
    } else {
      tracker.onMessageSent(timing)
    }
  }
})

cameraPreview(document.querySelector('#preview').parentNode, tracker)

function showAbout() {
  const { scrim, container, dialog } = createAbout()
  document.body.appendChild(scrim)
  document.body.appendChild(container)

  setTimeout(() => {
    scrim.classList.remove('entering')
    dialog.classList.remove('entering')
  }, 15)

  const clickListener = e => {
    if (e.target !== container) return

    container.removeEventListener('click', clickListener)
    // remove the dialog
    scrim.classList.add('will-leave')
    dialog.classList.add('will-leave')

    setTimeout(() => {
      scrim.classList.add('leaving')
      dialog.classList.add('leaving')

      scrim.addEventListener(transitionEvent, () => document.body.removeChild(scrim))
      dialog.addEventListener(transitionEvent, () => document.body.removeChild(container))
    }, 15)
  }
  container.addEventListener('click', clickListener)
}
