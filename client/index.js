import page from 'page'

import createAbout from './about'
import createActiveUsers from './active-users'
import analytics from './analytics'
import createDropdown from './dropdown'
import getFingerprint from './fingerprint'
import * as home from './home'
import io from './io'
import GlobalNotificationCounter from './notification-counter'
import * as room from './room'
import StoredSet from './stored-set'
import theme from './theme'
import transitionEvent from './transition-event'

const activeUsers = createActiveUsers()
const app = {
  muteSet: new StoredSet('mutes'),
  clientId: null,
  notificationCounter: new GlobalNotificationCounter(),
  activeUsers
}

io.on('connect', function() {
  io.emit('fingerprint', getFingerprint())
  io.emit('join', 'jpg')
}).on('disconnect', function() {
  activeUsers.count = 0
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
page('/', home.enter, done)
page.exit('/', home.exit)
page('/:room', room.enter, done)
page.exit('/:room', room.exit)
page.redirect('*', '/')

page.start()
