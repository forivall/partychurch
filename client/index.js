import page from 'page'
import ioNamespace from 'socket.io-client'

import createAbout from './about'
import createActiveUsers from './active-users'
import analytics from './analytics'
import createDropdown from './dropdown'
import getFingerprint from './fingerprint'
import * as home from './home'
import GlobalNotificationCounter from './notification-counter'
import * as room from './room'
import StoredSet from './stored-set'
import theme from './theme'
import transitionEvent from './transition-event'

import {BLANK_IMAGE} from './constants'
import homeTemplate from '../shared/views/index.pug'
import roomTemplate from '../shared/views/room.pug'

window.localStorage.debug = 'partychurch:*,engine.io-client:*'

const io = ioNamespace('/home')
const activeUsers = createActiveUsers()
const app = {
  io,
  muteSet: new StoredSet('mutes'),
  clientId: null,
  notificationCounter: new GlobalNotificationCounter(),
  activeUsers,
  get messageList() {
    const appRoom = app.room
    return appRoom == null ? null : appRoom.messageList
  },
  onjoin: Function.prototype
}

io.on('connect', function() {
  io.emit('fingerprint', getFingerprint())
}).on('disconnect', function() {
  activeUsers.count = 0
})

io.on('joinroom', function(exists) {
  app.onjoin(exists)
})

io.on('userid', function(id) {
  app.clientId = id
  if (app.messageList) app.messageList.clientId = id
})

createDropdown(document.querySelector('header .dropdown'), {
  logout: () => {
    console.log('todo')
  },
  unmute: () => {
    app.muteSet.clear()
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

// init theme
;(updateTheme => {
  theme.on('themeChange', updateTheme)
  updateTheme(theme.getTheme())
})(newTheme => {
  document.body.classList.toggle('dark', newTheme === 'dark')
  const otherTheme = newTheme === 'light' ? 'dark' : 'light'
  document.querySelector('#change-theme').textContent = `Use ${otherTheme} theme`
})

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

// router

const done = Function.prototype

// TODO: render out jade template of main content
let dispatch = true
page((ctx, next) => {
  ctx.dispatch = dispatch
  dispatch = false
  console.log(ctx)
  ctx.app = app
  next()
})


const childNodes = Array.from(document.body.childNodes)

let mainStart
let mainEnd
for (const childNode of childNodes) {
  if (childNode.nodeType === window.Node.COMMENT_NODE) {
    if (/!!! main start !!!/.test(childNode.textContent)) {
      mainStart = childNode
    } else if (/!!! main end !!!/.test(childNode.textContent)) {
      mainEnd = childNode
    }
  }
}

function render(template) {
  return (ctx, next) => {
    if (ctx.dispatch) return next()

    // clear out the main block
    while (mainStart.nextSibling !== mainEnd) {
      mainStart.nextSibling.remove()
    }

    // render the template into the main block
    const frag = document.createRange().createContextualFragment(template({BLANK_IMAGE}))
    document.body.insertBefore(frag, mainEnd)

    return next()
  }
}
page('/', render(homeTemplate), home.enter, done)
page.exit('/', home.exit)
page('/:room', room.allowed, render(roomTemplate), room.enter, done)
page.exit('/:room', room.exit)
page.redirect('*', '/')

page.start()
