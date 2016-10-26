import template from './views/about.pug'

const content = template()

module.exports = function() {
  const scrim = document.createElement('div')
  scrim.className = 'dialog-scrim entering'

  const container = document.createElement('div')
  container.className = 'dialog-container'
  const dialog = document.createElement('div')
  dialog.className = 'dialog about shadow-5 entering'
  dialog.innerHTML = content
  container.appendChild(dialog)

  return { scrim, container, dialog }
}
